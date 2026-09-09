import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { HealthModule } from "./health/health.module";
import { DatabaseModule } from "./db/database.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { OrgsModule } from "./orgs/orgs.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { MessagesModule } from "./messages/messages.module";
import { MeetingsModule } from "./meetings/meetings.module";
import { CallsModule } from "./calls/calls.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { FilesModule } from "./files/files.module";
import { TasksModule } from "./tasks/tasks.module";
import { ContactsModule } from "./contacts/contacts.module";
import { TicketsModule } from "./tickets/tickets.module";
import { PoliciesModule } from "./policies/policies.module";
import { AuditModule } from "./audit/audit.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { AdminModule } from "./admin/admin.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SearchModule } from "./search/search.module";
import { StorageModule } from "./storage/storage.module";
import { StatusesModule } from "./statuses/statuses.module";
import { AiModule } from "./ai/ai.module";
import { ConfigModule as ShineConfigModule } from "./config/config.module";
import { BillingModule } from "./billing/billing.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    ConversationsModule,
    MessagesModule,
    MeetingsModule,
    CallsModule,
    NotificationsModule,
    FilesModule,
    TasksModule,
    ContactsModule,
    TicketsModule,
    PoliciesModule,
    AuditModule,
    PermissionsModule,
    AdminModule,
    RealtimeModule,
    SearchModule,
    StorageModule,
    StatusesModule,
    AiModule,
    ShineConfigModule,
    BillingModule,
  ],
})
export class AppModule {}
