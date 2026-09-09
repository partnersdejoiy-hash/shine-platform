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
}
