import { Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { SearchService } from "./search.service";
@Controller("api/search")
@UseGuards(AuthGuard("jwt"))
export class SearchController {
  constructor(private svc: SearchService) {}
  @Get() search(@Query("q") q: string, @Req() req: any) { return this.svc.globalSearch(req.user.sub, q); }
}
