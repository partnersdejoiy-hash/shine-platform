import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateMeetingDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional() @IsString() description?: string;

  @IsDateString()
  startTime!: string;

  @IsOptional() @IsDateString() endTime?: string;

  @IsOptional() @IsString() password?: string;

  @IsOptional() @IsBoolean() recordingEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEmail({}, { each: true })
  inviteEmails?: string[];

  @IsOptional() @IsString() recurringRule?: string;
}
