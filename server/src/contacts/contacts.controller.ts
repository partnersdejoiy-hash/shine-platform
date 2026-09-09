import { Controller, Get, Post, Delete, Param, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ContactsService } from "./contacts.service";
@Controller("api/contacts")
@UseGuards(AuthGuard("jwt"))
export class ContactsController {
  constructor(private svc: ContactsService) {}
  @Get() list(@Req() req: any) { return this.svc.list(req.user.sub); }
  @Post(":contactId") add(@Param("contactId") cid: string, @Req() req: any) { return this.svc.add(req.user.sub, cid); }
  @Post(":contactId/favorite") fav(@Param("contactId") cid: string, @Req() req: any) { return this.svc.toggleFavorite(req.user.sub, cid); }
  @Post(":contactId/block") block(@Param("contactId") cid: string, @Req() req: any) { return this.svc.block(req.user.sub, cid); }
  @Delete(":contactId") remove(@Param("contactId") cid: string, @Req() req: any) { return this.svc.remove(req.user.sub, cid); }
}
