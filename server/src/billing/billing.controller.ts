import { Controller, Get, Post, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { BillingService } from "./billing.service";

@Controller("api/billing")
@UseGuards(AuthGuard("jwt"))
export class BillingController {
  constructor(private svc: BillingService) {}

  @Get("plans") plans() { return this.svc.getPlans(); }
  @Get("overview") overview(@Req() req: any) { return this.svc.overview(req.user.sub); }
  @Post("create-order") createOrder(@Req() req: any, @Body() body: any) { return this.svc.createOrder(req.user.sub, body); }
  @Post("verify-payment") verify(@Req() req: any, @Body() body: any) { return this.svc.verifyPayment(req.user.sub, body); }
}