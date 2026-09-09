import { Injectable, Inject, UnauthorizedException, ConflictException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { eq, and } from "drizzle-orm";
import { DB } from "../db/database.module";
import { users, passwords, presence, devices, organizations, organizationMembers } from "../db/schema";
import * as bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private db: any,
    private jwt: JwtService,
  ) {}

  async register(data: { email: string; password: string; name: string }) {
    const existing = await this.db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (existing.length > 0) throw new ConflictException("Email already registered");

    const now = Date.now();
    const [user] = await this.db.insert(users).values({
      email: data.email,
      name: data.name,
      role: "member",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const hash = await bcrypt.hash(data.password, 12);
    await this.db.insert(passwords).values({ userId: user.id, hash, history: [], updatedAt: now });
    await this.db.insert(presence).values({ userId: user.id, status: "online", updatedAt: now });

    return this.generateTokens(user.id, user.email, user.role);
  }

  async login(data: { email: string; password: string }) {
    const [user] = await this.db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (!user.isActive) throw new UnauthorizedException("Account deactivated");

    const [pwd] = await this.db.select().from(passwords).where(eq(passwords.userId, user.id)).limit(1);
    if (!pwd) throw new UnauthorizedException("No password set");

    const valid = await bcrypt.compare(data.password, pwd.hash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    await this.db.update(presence).set({ status: "online", updatedAt: Date.now() }).where(eq(presence.userId, user.id));

    return this.generateTokens(user.id, user.email, user.role);
  }

  async validateUser(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.isActive) return null;
    return user;
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET || "shine_refresh_secret_2024" });
      return this.generateTokens(payload.sub, payload.email, payload.role);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string) {
    await this.db.update(presence).set({ status: "offline", updatedAt: Date.now() }).where(eq(presence.userId, userId));
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const [pwd] = await this.db.select().from(passwords).where(eq(passwords.userId, userId)).limit(1);
    if (!pwd) throw new BadRequestException("No password set");

    const valid = await bcrypt.compare(oldPassword, pwd.hash);
    if (!valid) throw new UnauthorizedException("Current password incorrect");

    const newHash = await bcrypt.hash(newPassword, 12);
    const history = [...(pwd.history || []), pwd.hash].slice(0, 5);

    // Check password reuse
    for (const oldHash of history) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        throw new BadRequestException("Cannot reuse recent passwords");
      }
    }

    await this.db.update(passwords).set({ hash: newHash, history, updatedAt: Date.now() }).where(eq(passwords.userId, userId));
    await this.db.update(users).set({ mustChangePassword: false, passwordChangedAt: Date.now(), updatedAt: Date.now() }).where(eq(users.id, userId));
  }

  async resetPasswordRequest(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return { message: "If an account exists, a reset code has been sent" };

    const code = nanoid(8).toUpperCase();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
    await this.db.update(users).set({ tempAuthCode: code, tempAuthCodeExpiresAt: expiresAt, updatedAt: Date.now() }).where(eq(users.id, user.id));

    // TODO: Send email with code via email queue
    return { message: "If an account exists, a reset code has been sent", code: process.env.NODE_ENV === "development" ? code : undefined };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new UnauthorizedException("Invalid request");
    if (user.tempAuthCode !== code) throw new UnauthorizedException("Invalid code");
    if (user.tempAuthCodeExpiresAt && user.tempAuthCodeExpiresAt < Date.now()) throw new UnauthorizedException("Code expired");

    const hash = await bcrypt.hash(newPassword, 12);
    await this.db.update(passwords).set({ hash, history: [], updatedAt: Date.now() }).where(eq(passwords.userId, user.id));
    await this.db.update(users).set({ tempAuthCode: null, tempAuthCodeExpiresAt: null, mustChangePassword: false, updatedAt: Date.now() }).where(eq(users.id, user.id));
  }

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET || "shine_refresh_secret_2024",
        expiresIn: "7d",
      }),
      user: { id: userId, email, role },
    };
  }
}
