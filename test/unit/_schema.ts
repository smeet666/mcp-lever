// Vérificateur de JSON Schema réduit au vocabulaire que les schémas de sortie
// emploient : `type`, `enum`, `const`, `required`, `properties`,
// `additionalProperties: false`, `items`, `oneOf`, `anyOf` et `$ref` vers
// `#/$defs/…`.
//
// Une référence qui ne se résout pas est une erreur rendue, ce qui fait échouer
// le test qui l'emploie plutôt que de laisser passer une sortie non vérifiée.

type Json = unknown;

interface Schema {
  [key: string]: Json;
}

function typeOf(value: Json): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value: Json, expected: string): boolean {
  const actual = typeOf(value);
  if (expected === "number") return actual === "number" || actual === "integer";
  if (expected === "object") return actual === "object";
  return actual === expected;
}

function deepEqual(a: Json, b: Json): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resolve(schema: Schema, root: Schema, path: string, errors: string[]): Schema | null {
  const ref = schema["$ref"];
  if (typeof ref !== "string") return schema;
  const match = /^#\/\$defs\/(.+)$/.exec(ref);
  if (!match) {
    errors.push(`${path}: référence non résolue « ${ref} »`);
    return null;
  }
  const defs = root["$defs"] as Record<string, Schema> | undefined;
  const target = defs?.[match[1] as string];
  if (!target) {
    errors.push(`${path}: référence non résolue « ${ref} », $defs ne la porte pas`);
    return null;
  }
  return target;
}

function check(value: Json, schema: Schema, root: Schema, path: string, errors: string[]): void {
  const resolved = resolve(schema, root, path, errors);
  if (!resolved) return;
  const s = resolved;
  const scope = (s["$defs"] ? s : root) as Schema;

  const oneOf = s["oneOf"] ?? s["anyOf"];
  if (Array.isArray(oneOf)) {
    const branchErrors = oneOf.map((branch) => {
      const local: string[] = [];
      check(value, branch as Schema, scope, path, local);
      return local;
    });
    if (!branchErrors.some((e) => e.length === 0)) {
      errors.push(`${path}: aucune branche de oneOf n'accepte ${JSON.stringify(value)}`);
    }
    return;
  }

  if ("const" in s && !deepEqual(value, s["const"])) {
    errors.push(`${path}: attendu ${JSON.stringify(s["const"])}, reçu ${JSON.stringify(value)}`);
  }

  if (Array.isArray(s["enum"])) {
    if (!s["enum"].some((allowed) => deepEqual(allowed, value))) {
      errors.push(
        `${path}: ${JSON.stringify(value)} hors de l'énumération ${JSON.stringify(s["enum"])}`,
      );
    }
  }

  const type = s["type"];
  if (typeof type === "string" || Array.isArray(type)) {
    const allowed = Array.isArray(type) ? (type as string[]) : [type as string];
    if (!allowed.some((t) => matchesType(value, t))) {
      errors.push(`${path}: type ${typeOf(value)} hors de ${JSON.stringify(allowed)}`);
      return;
    }
  }

  if (typeOf(value) === "object") {
    const object = value as Record<string, Json>;
    const properties = (s["properties"] ?? {}) as Record<string, Schema>;

    const required = s["required"];
    if (Array.isArray(required)) {
      for (const key of required as string[]) {
        if (!(key in object)) errors.push(`${path}: la clé requise « ${key} » manque`);
      }
    }

    if (s["additionalProperties"] === false) {
      for (const key of Object.keys(object)) {
        if (!(key in properties)) errors.push(`${path}: clé inattendue « ${key} »`);
      }
    }

    for (const [key, sub] of Object.entries(properties)) {
      if (key in object) check(object[key], sub, scope, `${path}.${key}`, errors);
    }
  }

  if (typeOf(value) === "array" && s["items"]) {
    (value as Json[]).forEach((item, i) => {
      check(item, s["items"] as Schema, scope, `${path}[${i}]`, errors);
    });
  }
}

/** Rend la liste des manquements, vide quand la valeur respecte le schéma. */
export function validate(value: Json, schema: Schema): string[] {
  const errors: string[] = [];
  check(value, schema, schema, "$", errors);
  return errors;
}
