export class SeriesEventResponseDto {
  id!: number;
  title!: string;
  description?: string;
  roomid!: number;
  categoryid!: number;
  startTime!: string;
  endTime!: string;
  seriesStart!: Date;
  seriesEnd!: Date;
  weekdays!: number[];
  runDuringSchoolHolidays!: boolean;
  active!: boolean;
  lastGeneratedUntil?: Date;
  lastReorganizationAt?: Date;
}
