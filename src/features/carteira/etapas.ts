import type { Tom } from '@/components/ui';

export const TOM_ETAPA: Record<string, Tom> = {
  Estudo: 'neutro',
  'Traçado preliminar': 'neutro',
  'Projeto executivo': 'brand',
  Aprovado: 'ok',
  'Em obra': 'brand',
  Concluído: 'ok',
  'Cadastrado no GIS': 'extensao',
};

export const TOM_USO: Record<string, Tom> = {
  Projeto: 'projeto',
  Referência: 'brand',
  Arquivar: 'neutro',
  Excluir: 'existente',
};
