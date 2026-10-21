import { useTranslation } from '../i18n';
import type { TVInput } from '../types';

export function InputStatus({ input }: { input: TVInput }) {
  const { t } = useTranslation();
  if (input.connected === false) return t('noDevice');
  if (input.connected !== true) return t('externalInput');
  return input.title === input.port ? t('connected') : `${input.title} · ${t('connected')}`;
}
