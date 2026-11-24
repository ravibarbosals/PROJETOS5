// Conversões e simplificação dos limites das RPAs (DEC-038). Os arquivos da
// Prefeitura vêm em SIRGAS 2000 / UTM 25S (EPSG:31985); o mapa usa
// latitude/longitude (WGS84, que o SIRGAS 2000 acompanha para mapas).

export type Ponto = [number, number];

const A = 6378137;
const F = 1 / 298.257222101;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const FALSO_NORTE_SUL = 10_000_000;
const FALSO_ESTE = 500_000;
// Meridiano central do fuso 25: -33°
const MERIDIANO_CENTRAL = (-33 * Math.PI) / 180;

// UTM 25S -> [longitude, latitude] em graus, na ordem do GeoJSON
export function utm25sParaGraus([este, norte]: Ponto): Ponto {
  const x = este - FALSO_ESTE;
  const y = norte - FALSO_NORTE_SUL;
  const mu = y / K0 / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const p1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const c1 = EP2 * Math.cos(p1) ** 2;
  const t1 = Math.tan(p1) ** 2;
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(p1) ** 2);
  const r1 = (A * (1 - E2)) / (1 - E2 * Math.sin(p1) ** 2) ** 1.5;
  const d = x / (n1 * K0);
  const lat =
    p1 -
    ((n1 * Math.tan(p1)) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) *
          d ** 6) /
          720);
  const lon =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) * d ** 5) /
        120) /
    Math.cos(p1);
  return [
    ((MERIDIANO_CENTRAL + lon) * 180) / Math.PI,
    (lat * 180) / Math.PI,
  ];
}

function distanciaAoSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const tamanho2 = dx * dx + dy * dy;
  const t =
    tamanho2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / tamanho2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Douglas-Peucker: tira os vértices que desviam menos que a tolerância (na
// unidade das coordenadas; em UTM, metros). Mantém o primeiro e o último.
export function simplificar(linha: Ponto[], tolerancia: number): Ponto[] {
  if (linha.length <= 2) return linha;
  let maior = 0;
  let indice = 0;
  for (let i = 1; i < linha.length - 1; i++) {
    const d = distanciaAoSegmento(linha[i], linha[0], linha[linha.length - 1]);
    if (d > maior) {
      maior = d;
      indice = i;
    }
  }
  if (maior <= tolerancia) return [linha[0], linha[linha.length - 1]];
  const antes = simplificar(linha.slice(0, indice + 1), tolerancia);
  return [...antes.slice(0, -1), ...simplificar(linha.slice(indice), tolerancia)];
}

// Ray casting: o ponto está dentro do anel? Anel em [longitude, latitude].
function dentroDoAnel([x, y]: Ponto, anel: Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

// MultiPolygon do GeoJSON: dentro do contorno de algum polígono e fora dos
// buracos dele.
export function dentroDoMultiPoligono(ponto: Ponto, poligonos: Ponto[][][]): boolean {
  return poligonos.some(
    ([contorno, ...buracos]) =>
      dentroDoAnel(ponto, contorno) && !buracos.some((b) => dentroDoAnel(ponto, b)),
  );
}
