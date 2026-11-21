import 'leaflet/dist/leaflet.css'
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { formatarNumero } from '@/lib/format'
import {
  corDaChuva,
  corDoAlerta,
  corDoRisco,
  enquadramento,
  rotuloDoRisco,
} from '@/modules/mapa/camadas'
import type { AreaRisco, CamadaRpa, RpaMapa } from '@/modules/mapa/types'

interface MapaLeafletProps {
  rpas: RpaMapa[]
  areas: AreaRisco[]
  camada: CamadaRpa
  mostrarAreas: boolean
}

const CENTRO_DO_RECIFE: [number, number] = [-8.05, -34.92]

// DEC-038: fundo do OpenStreetMap, as RPAs pelo limite oficial e os pontos da
// Defesa Civil por cima.
export function MapaLeaflet({ rpas, areas, camada, mostrarAreas }: MapaLeafletProps) {
  // Abre enquadrado nas RPAs; sem limite gravado, no centro do Recife
  const limites = enquadramento(rpas)
  const visao = limites
    ? { bounds: limites, boundsOptions: { padding: [12, 12] as [number, number] } }
    : { center: CENTRO_DO_RECIFE, zoom: 11 }

  return (
    <MapContainer {...visao} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {rpas.map((rpa) =>
        rpa.limite ? (
          // O GeoJSON do react-leaflet não refaz o estilo sozinho: a chave
          // com a camada recria a forma quando ela muda
          <GeoJSON
            key={`${rpa.rpa}-${camada}`}
            data={rpa.limite}
            style={{
              color: '#1e293b',
              weight: 1.5,
              fillOpacity: 0.45,
              fillColor:
                camada === 'alerta' ? corDoAlerta(rpa.alerta_nivel) : corDaChuva(rpa.chuva_24h_mm),
            }}
          >
            <Tooltip sticky>
              <strong>{rpa.nome}</strong>
              <br />
              População: {rpa.populacao === null ? '—' : formatarNumero(rpa.populacao)}
              <br />
              Chuva 24 h:{' '}
              {rpa.chuva_24h_mm === null ? 'sem leitura' : `${formatarNumero(rpa.chuva_24h_mm)} mm`}
              <br />
              Alerta: {rpa.alerta_nivel ?? 'nenhum ativo'}
            </Tooltip>
          </GeoJSON>
        ) : null,
      )}
      {mostrarAreas &&
        areas.map((area) => (
          <CircleMarker
            key={area.id}
            center={[area.latitude, area.longitude]}
            radius={5}
            pathOptions={{
              color: '#ffffff',
              weight: 1,
              fillColor: corDoRisco(area.nivel),
              fillOpacity: 0.9,
            }}
          >
            <Tooltip>
              <strong>{rotuloDoRisco(area.nivel)}</strong> · {area.localidade}
              <br />
              {area.endereco} ({area.bairro})
              <br />
              {area.descricao}
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  )
}
