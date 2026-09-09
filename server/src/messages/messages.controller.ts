import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { MessagesService } from "./messages.service";

@Controller("api/messages")
@UseGuards(AuthGuard("jwt"))
export class MessagesController {
  constructor(private msgService: MessagesService) {}

  @Post()
  send(@Req() req: any, @Body() body: any) {
    return this.msgService.send(req.user.sub, body);
  }

  @Get("search")
  search(@Query("q") q: string, @Req() req: any, @Query("conversationId") convId?: string) {
    return this.msgService.search(q, req.user.sub, convId);
  }

  @Get("conversation/:conversationId")
  list(@Param("conversationId") convId: string, @Query("limit") limit?: string, @Query("before") before?: string) {
    return this.msgService.list(convId, limit ? parseInt(limit) : 50, before ? parseInt(before) : undefined);
  }

  @Get("thread/:parentId")
  thread(@Param("parentId") parentId: string) {
    return this.msgService.getThread(parentId);
  }

  @Put(":id")
  edit(@Param("id") id: string, @Req() req: any, @Body() body: { body: string }) {
    return this.msgService.edit(id, req.user.sub, body.body);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @Req() req: any) {
    return this.msgService.delete(id, req.user.sub);
  }

  @Post(":id/reactions")
  addReaction(@Param("id") id: string, @Req() req: any, @Body() body: { emoji: string }) {
    return this.msgService.addReaction(id, req.user.sub, body.emoji);
  }

  @Delete(":id/reactions/:emoji")
  removeReaction(@Param("id") id: string, @Param("emoji") emoji: string, @Req() req: any) {
    return this.msgService.removeReaction(id, req.user.sub, emoji);
  }

  @Get(":id/reactions")
  getReactions(@Param("id") id: string) {
    return this.msgService.getReactions(id);
  }

  @Post(":id/pin")
  pin(@Param("id") id: string, @Req() req: any, @Body() body: { conversationId: string }) {
    return this.msgService.pin(id, req.user.sub, body.conversationId);
  }

  @Post(":id/forward")
  forward(@Param("id") id: string, @Req() req: any, @Body() body: { toConversationId: string }) {
    return this.msgService.forward(id, body.toConversationId, req.user.sub);
  }

  @Post(":id/unpin")
  unpin(@Param("id") id: string, @Body() body: { conversationId: string }) {
    return this.msgService.unpin(id, body.conversationId);
  }

  @Post(":id/delete-me")
  deleteForMe(@Param("id") id: string, @Req() req: any) {
    return this.msgService.deleteForMe(id, req.user.sub);
  }

  @Post(":id/bookmark")
  bookmark(@Param("id") id: string, @Req() req: any) {
    return this.msgService.toggleBookmark(id, req.user.sub);
  }

  @Get("bookmarks")
  myBookmarks(@Req() req: any) {
    return this.msgService.myBookmarks(req.user.sub);
  }

  @Post(":id/polls")
  createPoll(@Param("id") id: string, @Req() req: any, @Body() body: { question: string; options: { text: string }[] }) {
    return this.msgService.createPoll(id, req.user.sub, body);
  }

  @Post(":id/polls/close")
  closePoll(@Param("id") id: string, @Req() req: any) {
    return this.msgService.closePoll(id, req.user.sub);
  }

  @Post(":id/polls/vote")
  votePoll(@Param("id") id: string, @Req() req: any, @Body() body: { optionId: string }) {
    return this.msgService.votePoll(id, req.user.sub, body.optionId);
  }
}
