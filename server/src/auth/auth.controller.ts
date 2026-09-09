import { Controller, Post, Body, Req, UseGuards, Get } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "@nestjs/passport";

@Controller("api/auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  register(@Body() body: { email: string; password: string; name: string }) {
    return this.authService.register(body);
  }

  @Post("login")
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @Post("refresh")
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @UseGuards(AuthGuard("jwt"))
  @Post("logout")
  async logout(@Req() req: any) {
    await this.authService.logout(req.user.sub);
    return { message: "Logged out" };
  }

  @UseGuards(AuthGuard("jwt"))
  @Post("change-password")
  changePassword(@Req() req: any, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.sub, body.oldPassword, body.newPassword);
  }

  @Post("forgot-password")
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.resetPasswordRequest(body.email);
  }

  @Post("reset-password")
  resetPassword(@Body() body: { email: string; code: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("me")
  async me(@Req() req: any) {
    const user = await this.authService.validateUser(req.user.sub);
    return user;
  }

  @Get("provider-status")
  providerStatus() {
    return this.authService.authProviderStatus();
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("has-password")
  async hasPassword(@Req() req: any) {
    return { has: await this.authService.hasPassword(req.user.sub) };
  }

  @UseGuards(AuthGuard("jwt"))
  @Post("set-password")
  setPassword(@Req() req: any, @Body() body: { password?: string; newPassword?: string }) {
    return this.authService.setPassword(req.user.sub, body.password || body.newPassword);
  }

  @Post("set-password-code")
  setPasswordWithCode(@Body() body: { email: string; code: string; password: string; newPassword?: string }) {
    return this.authService.setPasswordWithCode(body.email, body.code, body.password || body.newPassword);
  }

  @UseGuards(AuthGuard("jwt"))
  @Post("temp-code")
  tempCode(@Req() req: any) {
    return this.authService.issueTempCode(undefined, req.user.sub);
  }

  @Post("resend-temp-password")
  resendTempPassword(@Body() body: { email: string }) {
    return this.authService.resendTempPassword(body.email);
  }

  @UseGuards(AuthGuard("jwt"))
  @Post("admin-provision-password")
  adminProvisionPassword(@Req() req: any, @Body() body: any) {
    return this.authService.adminProvisionPassword(req.user.sub, body);
  }
}
