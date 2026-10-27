import { Dialog } from '@base-ui/react/dialog';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import { InfoIcon } from '../../ui/icons';
import { quietButton, secondaryButton } from '../../ui/styles';
import type { SimulationResult } from '../models/simulation.types';

function annualNote(kind: RemunerationKind): string | null {
  switch (kind) {
    case 'PREFIXED':
      return 'Por isso, num prefixado, a rentabilidade bruta ao ano é a própria taxa da oferta.';
    case 'CDI_PERCENTAGE':
      return 'Num pós-fixado, ela acompanha os valores da curva de CDI multiplicados pelo percentual contratado.';
    case 'SELIC_PERCENTAGE':
      return 'Num pós-fixado, ela acompanha os valores da curva de SELIC multiplicados pelo percentual contratado.';
    case 'IPCA_PLUS':
      return null;
  }
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: string;
}) {
  return (
    <section className="grid gap-1 border-t border-border pt-4">
      <h3 className="m-0 text-base font-semibold">{title}</h3>
      <p className="m-0 text-muted">{children}</p>
    </section>
  );
}

export function RateOfReturnExplanationDialog({
  result,
  remunerationKind,
}: {
  readonly result: SimulationResult;
  readonly remunerationKind: RemunerationKind;
}) {
  const note = annualNote(remunerationKind);
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={`${quietButton} gap-2 justify-self-start px-0`}
      >
        <InfoIcon />
        Como a rentabilidade é calculada
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-fg opacity-30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 grid max-h-[calc(100dvh-2rem)] w-xl max-w-[calc(100vw-2rem)] -translate-1/2 content-start gap-4 overflow-y-auto rounded-surface border border-border bg-surface p-6 text-fg outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="m-0 text-lg font-semibold">
              Rentabilidade
            </Dialog.Title>
            <Dialog.Close className={secondaryButton}>Fechar</Dialog.Close>
          </div>
          <Dialog.Description className="m-0">
            Mostra quanto o investimento rende sobre o valor aplicado, supondo
            que o dinheiro fique aplicado até o vencimento: o resgate antecipado
            ainda não é calculado.
          </Dialog.Description>
          <Section title="Líquida e bruta">
            A líquida desconta o IOF e o imposto de renda; a bruta é o
            rendimento antes dos tributos.
          </Section>
          <Section title="No período">
            Quanto o valor aplicado rende da aplicação até o vencimento.
          </Section>
          <Section title="Ao ano">
            {`Distribui a rentabilidade do período em anos de 252 dias úteis, a mesma convenção usada nos juros. Este cálculo tem ${result.term.businessDays} dias úteis.${note ? ` ${note}` : ''}`}
          </Section>
          <Section title="Ao mês">
            É a taxa mensal constante equivalente à taxa ao ano, e não o que
            cada mês rendeu. O rendimento de cada mês está em “Evolução do
            saldo”.
          </Section>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
