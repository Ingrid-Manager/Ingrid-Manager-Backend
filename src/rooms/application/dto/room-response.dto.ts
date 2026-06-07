export class RoomResponseDto {
  id!: number;
  title!: string;
  avm_id!: string;
  comfort_temp!: number;
  empty_temp!: number;
  prelim_time!: number;
  heated!: boolean;
  color!: string;
  hidden!: boolean;
  locationid!: number;

  location?: {
    id: number;
    name?: string;
  };
}
