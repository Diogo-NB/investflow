import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SimulationComparisonRequest } from './simulation-comparison.request';

const A = '0b6f4f9e-6a43-4c4e-9f43-2f6f3c1f6a01';
const B = '0b6f4f9e-6a43-4c4e-9f43-2f6f3c1f6a02';

const parse = (ids: string) =>
  plainToInstance(SimulationComparisonRequest, { ids });

describe('SimulationComparisonRequest', () => {
  it('splits comma-separated ids', () => {
    const request = parse(`${A},${B}`);

    expect(request.ids).toEqual([A, B]);
    expect(validateSync(request)).toEqual([]);
  });

  it('rejects a single id', () => {
    expect(validateSync(parse(A))).not.toEqual([]);
  });
});
