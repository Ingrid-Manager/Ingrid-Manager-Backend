export class ResourceEventResponseDto {
  id!: number;
  title!: string;
  start!: Date;
  end!: Date;
  color?: string;
  resource_id?: number;
  resource_title?: string;
  user_id?: number;
  user_name?: string;
}
