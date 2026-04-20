// =============================================================================
// Geração de PDF — Propostas Comerciais
// Usa @react-pdf/renderer (React → PDF server-side)
// =============================================================================

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'
import type { ItemProposta } from '@/types'
import { formatDateInAppTimeZone } from '@/lib/timezone'

type PropostaPDFData = {
  id: string
  titulo: string
  descricao: string | null
  itens: unknown
  valorTotal: number
  createdAt: Date
  validade: Date | null
  cliente: {
    nome: string
    email: string
  }
}

// Registra fontes (opcional — melhora tipografia)
// Font.register({
//   family: 'Inter',
//   src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
// })

// ---------------------------------------------------------------------------
// Estilos do PDF
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#6366f1',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#6366f1',
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  proposalLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'Helvetica',
  },
  proposalNumber: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 2,
  },
  // Dados da proposta
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 6,
  },
  infoBlock: {
    flexDirection: 'column',
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontFamily: 'Helvetica',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 12,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  // Título e descrição
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  descricaoText: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  // Tabela de itens
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    padding: '8 12',
    borderRadius: '4 4 0 0',
  },
  tableHeaderText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '10 12',
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  colNome: { flex: 3 },
  colQtd: { flex: 1, textAlign: 'center' },
  colValor: { flex: 1.5, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  cellText: {
    fontSize: 11,
    color: '#374151',
  },
  cellTextBold: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  // Totais
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 12,
    borderTop: 2,
    borderTopColor: '#e5e7eb',
  },
  totalBox: {
    backgroundColor: '#6366f1',
    padding: '12 20',
    borderRadius: 6,
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 11,
    color: '#c7d2fe',
    fontFamily: 'Helvetica',
  },
  totalValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  // Validade e CTA
  validadeSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    borderLeft: 4,
    borderLeftColor: '#f59e0b',
  },
  validadeText: {
    fontSize: 11,
    color: '#92400e',
    fontFamily: 'Helvetica',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#9ca3af',
  },
})

// ---------------------------------------------------------------------------
// Formata moeda BRL
// ---------------------------------------------------------------------------
function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

// ---------------------------------------------------------------------------
// Formata data para pt-BR
// ---------------------------------------------------------------------------
function dataFormatada(date: Date | string): string {
  return formatDateInAppTimeZone(date)
}

// ---------------------------------------------------------------------------
// Componente do documento PDF
// ---------------------------------------------------------------------------
function PropostaPDFDocument({
  proposta,
}: {
  proposta: PropostaPDFData
}) {
  const itens = (proposta.itens as ItemProposta[]) ?? []

  return React.createElement(
    Document,
    {
      title: proposta.titulo,
      author: 'Volve',
      subject: 'Proposta Comercial',
    },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },

      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerLeft },
          React.createElement(Text, { style: styles.brandName }, 'VOLVE'),
          React.createElement(
            Text,
            { style: styles.brandTagline },
            'Agência Digital · volve.com.br',
          ),
        ),
        React.createElement(
          View,
          { style: styles.headerRight },
          React.createElement(
            Text,
            { style: styles.proposalLabel },
            'PROPOSTA COMERCIAL',
          ),
          React.createElement(
            Text,
            { style: styles.proposalNumber },
            `#${proposta.id.slice(0, 8).toUpperCase()}`,
          ),
        ),
      ),

      // Info: cliente + datas
      React.createElement(
        View,
        { style: styles.infoSection },
        React.createElement(
          View,
          { style: styles.infoBlock },
          React.createElement(Text, { style: styles.infoLabel }, 'CLIENTE'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            proposta.cliente.nome,
          ),
          React.createElement(
            Text,
            { style: { ...styles.infoLabel, marginTop: 4 } },
            proposta.cliente.email,
          ),
        ),
        React.createElement(
          View,
          { style: { ...styles.infoBlock, alignItems: 'flex-end' } },
          React.createElement(Text, { style: styles.infoLabel }, 'DATA'),
          React.createElement(
            Text,
            { style: styles.infoValue },
            dataFormatada(proposta.createdAt),
          ),
          proposta.validade
            ? React.createElement(
                View,
                null,
                React.createElement(
                  Text,
                  { style: { ...styles.infoLabel, marginTop: 8 } },
                  'VÁLIDA ATÉ',
                ),
                React.createElement(
                  Text,
                  { style: styles.infoValue },
                  dataFormatada(proposta.validade),
                ),
              )
            : null,
        ),
      ),

      // Título e descrição
      React.createElement(
        Text,
        { style: styles.sectionTitle },
        proposta.titulo,
      ),
      proposta.descricao
        ? React.createElement(
            Text,
            { style: styles.descricaoText },
            proposta.descricao,
          )
        : null,

      // Tabela de itens
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(
          Text,
          { style: { ...styles.tableHeaderText, ...styles.colNome } },
          'SERVIÇO / ITEM',
        ),
        React.createElement(
          Text,
          { style: { ...styles.tableHeaderText, ...styles.colQtd } },
          'QTD',
        ),
        React.createElement(
          Text,
          { style: { ...styles.tableHeaderText, ...styles.colValor } },
          'VALOR UNIT.',
        ),
        React.createElement(
          Text,
          { style: { ...styles.tableHeaderText, ...styles.colTotal } },
          'TOTAL',
        ),
      ),

      ...itens.map((item, idx) =>
        React.createElement(
          View,
          {
            key: idx,
            style: {
              ...styles.tableRow,
              ...(idx % 2 === 1 ? styles.tableRowAlt : {}),
            },
          },
          React.createElement(
            View,
            { style: styles.colNome },
            React.createElement(
              Text,
              { style: styles.cellTextBold },
              item.nome,
            ),
            item.descricao
              ? React.createElement(
                  Text,
                  { style: { ...styles.cellText, fontSize: 9, color: '#6b7280' } },
                  item.descricao,
                )
              : null,
          ),
          React.createElement(
            Text,
            { style: { ...styles.cellText, ...styles.colQtd } },
            String(item.quantidade),
          ),
          React.createElement(
            Text,
            { style: { ...styles.cellText, ...styles.colValor } },
            moeda(item.valorUnitario),
          ),
          React.createElement(
            Text,
            { style: { ...styles.cellTextBold, ...styles.colTotal } },
            moeda(item.quantidade * item.valorUnitario),
          ),
        ),
      ),

      // Total
      React.createElement(
        View,
        { style: styles.totalSection },
        React.createElement(
          View,
          { style: styles.totalBox },
          React.createElement(
            Text,
            { style: styles.totalLabel },
            'INVESTIMENTO TOTAL',
          ),
          React.createElement(
            Text,
            { style: styles.totalValue },
            moeda(proposta.valorTotal),
          ),
        ),
      ),

      // Validade
      proposta.validade
        ? React.createElement(
            View,
            { style: styles.validadeSection },
            React.createElement(
              Text,
              { style: styles.validadeText },
              `⚠️  Esta proposta é válida até ${dataFormatada(proposta.validade)}. ` +
                'Após esse prazo, os valores podem ser reajustados.',
            ),
          )
        : null,

      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          'Volve Agência Digital · contato@volve.com.br · volve.com.br',
        ),
        React.createElement(
          Text,
          { style: styles.footerText },
          `Gerado em ${dataFormatada(new Date())}`,
        ),
      ),
    ),
  )
}

// ---------------------------------------------------------------------------
// Gera o buffer do PDF da proposta
// Retorna um Buffer para ser salvo ou enviado como resposta HTTP
// ---------------------------------------------------------------------------
export async function generatePropostaPDF(
  proposta: PropostaPDFData,
): Promise<Buffer> {
  const element = React.createElement(PropostaPDFDocument, { proposta })
  const buffer = await renderToBuffer(element as React.ReactElement)
  return Buffer.from(buffer)
}
