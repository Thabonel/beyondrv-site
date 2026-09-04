/**
 * Variant labels are the only thing a customer sees in the picker, and picking
 * the wrong row means calculating a slide-on against the wrong ratings. So a
 * label has to name everything that separates one row from another.
 *
 * The base label carries what always matters, including body type: a cab
 * chassis takes a tray and a pickup tub does not, and the two can otherwise
 * read identically. Anything further is added only where it is needed to tell
 * two rows apart, so common vehicles stay readable.
 */

export interface LabelSource {
  make: string;
  model: string;
  grade: string;
  cabType: string;
  bodyType: string;
  drivetrain: string | null;
  modelYear: number;
  engine: string | null;
  transmission: string | null;
  wheelbaseMm: number | null;
  payloadKg?: number | null;
}

const words = (value: string) => value.replace(/_/g, ' ');

/**
 * Some models carry their grade in the model name, and repeating it reads as a
 * stutter: "Ford Ranger Super Duty Super Duty single cab". Drop the grade only
 * when the model ends with it, which is the case that stutters. A grade that
 * merely shares a word with the model ("Super" against "Ranger Super Duty")
 * still separates one row from another, so it is kept.
 */
function gradeUnlessInModel(model: string, grade: string) {
  if (!grade) return grade;
  const m = model.trim().toLowerCase();
  const g = grade.trim().toLowerCase();
  if (m === g) return '';
  return m.endsWith(` ${g}`) ? '' : grade;
}

function baseLabel(row: LabelSource) {
  return [
    row.make,
    row.model,
    gradeUnlessInModel(row.model, row.grade),
    words(row.cabType),
    words(row.bodyType),
    row.drivetrain,
    `(${row.modelYear})`,
  ].filter(Boolean).join(' ');
}

/**
 * Engine strings carry power and torque after a semicolon. The description
 * alone separates the rows; the figures only make the option unreadable.
 */
function engineDescription(engine: string | null) {
  return engine ? engine.split(';')[0].trim() : '';
}

/** Tried in order until a group of same-labelled rows is separated. */
const DISAMBIGUATORS: Array<(row: LabelSource) => string> = [
  (row) => engineDescription(row.engine),
  (row) => (row.transmission ? row.transmission : ''),
  (row) => (row.wheelbaseMm ? `${row.wheelbaseMm}mm wheelbase` : ''),
  // A payload-rating option pack is the customer's own choice at purchase, so
  // it is something they can recognise — unlike a database id.
  (row) => (row.payloadKg ? `${row.payloadKg} kg payload` : ''),
];

function groupByLabel(labels: string[]) {
  const groups = new Map<string, number[]>();
  labels.forEach((label, index) => {
    const bucket = groups.get(label);
    if (bucket) bucket.push(index);
    else groups.set(label, [index]);
  });
  return groups;
}

export function buildVariantLabels(rows: LabelSource[]): string[] {
  const labels = rows.map(baseLabel);

  for (const extra of DISAMBIGUATORS) {
    const collisions = [...groupByLabel(labels).values()].filter((indexes) => indexes.length > 1);
    if (collisions.length === 0) break;

    for (const indexes of collisions) {
      // Only worth appending when it actually separates the group.
      const values = indexes.map((i) => extra(rows[i]));
      if (values.some((value) => !value)) continue;
      if (new Set(values).size === 1) continue;
      indexes.forEach((i, position) => {
        labels[i] = `${labels[i]} ${values[position]}`;
      });
    }
  }

  // Nothing in the data separates these rows. A silently duplicated option is
  // worse than an ugly one, so fall back to the variant id.
  const remaining = [...groupByLabel(labels).values()].filter((indexes) => indexes.length > 1);
  for (const indexes of remaining) {
    indexes.forEach((i) => {
      labels[i] = `${labels[i]} [${(rows[i] as LabelSource & { id?: string }).id ?? i}]`;
    });
  }

  return labels;
}
