import { mudancaDaAcao } from '@/modules/alertas/alerta/domain/acao-manual';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';

const AGORA = new Date('2026-11-19T10:00:00Z');

describe('mudancaDaAcao (RN-015)', () => {
  it('closes the alert as MANUAL (#4)', () => {
    expect(mudancaDaAcao(TipoAcaoManual.Encerrar, AGORA)).toEqual({
      status: StatusAlerta.Encerrado,
      motivoEncerramento: MotivoEncerramento.Manual,
      dthrEncerramento: AGORA,
    });
  });

  it('closes the alert as INVALIDADO (#5)', () => {
    expect(mudancaDaAcao(TipoAcaoManual.Invalidar, AGORA)).toEqual({
      status: StatusAlerta.Encerrado,
      motivoEncerramento: MotivoEncerramento.Invalidado,
      dthrEncerramento: AGORA,
    });
  });

  it('extends from now, keeping the alert active (#6)', () => {
    expect(mudancaDaAcao(TipoAcaoManual.Prorrogar, AGORA, 3)).toEqual({
      prorrogadoAte: new Date('2026-11-19T13:00:00Z'),
    });
  });

  it('refuses to extend without hours', () => {
    expect(() => mudancaDaAcao(TipoAcaoManual.Prorrogar, AGORA)).toThrow();
  });
});
