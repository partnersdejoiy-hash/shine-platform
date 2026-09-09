import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
}

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() roleName?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() designation?: string;
}
