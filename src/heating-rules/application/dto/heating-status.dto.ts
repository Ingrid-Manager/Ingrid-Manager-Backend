export class HeatingRoomStatusDto {
  roomId!: number;
  title!: string;
  avmId!: string | null;
  heated!: boolean;
  isHallway!: boolean;
}

export class HeatingStatusDto {
  enabled!: boolean;
  seasonStart!: string | null;
  seasonEnd!: string | null;
  inSeason!: boolean;
  hallwayRoomId!: number | null;
  rooms!: HeatingRoomStatusDto[];
}
