import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { RoleEnum } from '../roles/roles.enum';

import { OwnershipTransferService } from './ownership-transfer.service';
import { TransferOwnerDto } from './dto/transfer-owner.dto';

/*
 * Bewusst ausschließlich Admin (keine Verwaltung): erlaubt es, den Besitzer
 * eines beliebigen Termins/Serientermins auf einen beliebigen Nutzer zu
 * ändern, unabhängig davon, wer den Termin ursprünglich angelegt hat.
 */
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'ownership-transfer',
  version: '1',
})
export class OwnershipTransferController {
  constructor(private readonly service: OwnershipTransferService) {}

  @Post()
  transfer(@Body() dto: TransferOwnerDto, @Req() req) {
    return this.service.transfer(dto, req.user);
  }
}
