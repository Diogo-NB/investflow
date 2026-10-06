import { HttpErrorResponse, HttpResourceRef } from '@angular/common/http';

export function isMissingOffer(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 404 || error.status === 400)
  );
}
export function offerError(
  error: unknown,
  action: 'read' | 'save' | 'delete' = 'read',
): string {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    const code =
      body && typeof body === 'object' && 'code' in body
        ? body.code
        : undefined;
    if (error.status === 401)
      return 'Sua sessão não está disponível. Recarregue a página para entrar novamente.';
    if (error.status === 403)
      return 'Sua conta não tem acesso a esta operação.';
    if (code === 'ISSUER_NOT_FOUND')
      return 'O emissor selecionado não está mais disponível. Escolha outro emissor.';
    if (code === 'INVALID_RATE')
      return 'Revise o percentual: informe um valor válido e maior que zero.';
    if (code === 'INVALID_CALENDAR_DATE') return 'Revise a data de vencimento.';
    if (error.status === 404)
      return 'Esta oferta não está mais disponível. Volte à lista para consultar as ofertas atuais.';
    if (error.status === 400 || error.status === 422)
      return action === 'read'
        ? 'Este endereço de oferta é inválido. Volte à lista.'
        : 'Revise os dados informados antes de tentar novamente.';
    if (error.status === 0 && action !== 'read')
      return 'Não foi possível confirmar a operação. Confira a lista de ofertas antes de tentar novamente.';
  }
  return action === 'read'
    ? 'Não foi possível carregar os dados. Tente novamente.'
    : action === 'delete'
      ? 'Não foi possível excluir a oferta. Tente novamente.'
      : 'Não foi possível salvar a oferta. Seus dados foram mantidos; tente novamente.';
}
export type ReadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T; refreshing: boolean }
  | { status: 'error'; message: string; missing: boolean };
export function resourceState<T>(
  resource: HttpResourceRef<T | undefined>,
): ReadState<T> {
  if (resource.hasValue())
    return {
      status: 'ready',
      value: resource.value(),
      refreshing: resource.isLoading(),
    };
  const error = resource.error();
  if (error)
    return {
      status: 'error',
      message: offerError(error),
      missing: isMissingOffer(error),
    };
  return { status: 'loading' };
}
