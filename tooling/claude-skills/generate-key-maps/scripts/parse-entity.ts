import ts from 'typescript';
import fs from 'node:fs';
import type { Column, EntityModel, Relation, ColumnType } from './lib/types.ts';

/**
 * Parse a mikro-orm entity file and return its structural model.
 * Uses the TypeScript Compiler API for AST traversal — no regex.
 */
export function parseEntity(filePath: string): EntityModel {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  let className = '';
  let tableName = '';
  let schema: string | undefined;
  let primaryKey = '';
  const columns: Column[] = [];
  const relations: Relation[] = [];

  function readObjectLiteral(node: ts.ObjectLiteralExpression): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      const key = prop.name.text;
      const init = prop.initializer;
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        out[key] = init.text;
      } else if (init.kind === ts.SyntaxKind.TrueKeyword) {
        out[key] = true;
      } else if (init.kind === ts.SyntaxKind.FalseKeyword) {
        out[key] = false;
      } else if (ts.isNumericLiteral(init)) {
        out[key] = Number(init.text);
      } else if (
        ts.isArrowFunction(init) &&
        init.body &&
        ts.isIdentifier(init.body)
      ) {
        // pattern: () => SomeClass
        out[key] = { __classRef: init.body.text };
      } else if (ts.isIdentifier(init)) {
        out[key] = { __identifier: init.text };
      }
    }
    return out;
  }

  function decoratorOptions(deco: ts.Decorator): Record<string, unknown> {
    if (!ts.isCallExpression(deco.expression)) return {};
    for (const arg of deco.expression.arguments) {
      if (ts.isObjectLiteralExpression(arg)) {
        return readObjectLiteral(arg);
      }
    }
    return {};
  }

  function decoratorName(deco: ts.Decorator): string {
    const expr = deco.expression;
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
      return expr.expression.text;
    }
    if (ts.isIdentifier(expr)) return expr.text;
    return '';
  }

  function getDecorators(node: ts.HasDecorators): readonly ts.Decorator[] {
    return ts.getDecorators(node) ?? [];
  }

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const classDecorators = getDecorators(node);
      const entityDeco = classDecorators.find((d) => decoratorName(d) === 'Entity');
      if (entityDeco) {
        className = node.name.text;
        const opts = decoratorOptions(entityDeco);
        tableName = String(opts.tableName ?? '');
        schema = opts.schema ? String(opts.schema) : undefined;

        for (const member of node.members) {
          if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;
          const propName = member.name.text;
          const decos = getDecorators(member);

          for (const deco of decos) {
            const dn = decoratorName(deco);
            const opts = decoratorOptions(deco);

            if (dn === 'PrimaryKey') {
              primaryKey = propName;
              columns.push({
                name: propName,
                columnType: String(opts.columnType ?? 'uuid') as ColumnType,
                nullable: Boolean(opts.nullable),
                hasDefault: 'default' in opts || 'defaultRaw' in opts,
              });
            } else if (dn === 'Property') {
              columns.push({
                name: propName,
                columnType: String(opts.columnType ?? 'varchar') as ColumnType,
                nullable: Boolean(opts.nullable),
                hasDefault: 'default' in opts || 'defaultRaw' in opts,
              });
            } else if (dn === 'ManyToOne' || dn === 'OneToMany' || dn === 'OneToOne') {
              // The target class comes from the first arg: () => Class
              let targetClass = '';
              if (ts.isCallExpression(deco.expression)) {
                const firstArg = deco.expression.arguments[0];
                if (ts.isArrowFunction(firstArg) && firstArg.body && ts.isIdentifier(firstArg.body)) {
                  targetClass = firstArg.body.text;
                }
              }
              const rel: Relation = {
                kind: dn,
                targetClass,
                nullable: Boolean(opts.nullable),
              };
              // ManyToOne and OneToOne both own a FK column declared via fieldName.
              // OneToMany is the inverse side, owns no column, references the FK by mappedBy.
              if ((dn === 'ManyToOne' || dn === 'OneToOne') && opts.fieldName) {
                rel.fieldName = String(opts.fieldName);
              }
              if (dn === 'OneToMany' && opts.mappedBy) {
                rel.mappedBy = String(opts.mappedBy);
              }
              relations.push(rel);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);

  if (!className) {
    throw new Error(`No @Entity class found in ${filePath}`);
  }

  return {
    className,
    filePath,
    tableName,
    schema,
    primaryKey,
    columns,
    relations,
  };
}

// Allow CLI usage: `npx tsx parse-entity.ts <path>` → JSON to stdout
if (process.argv[1] && process.argv[1].endsWith('parse-entity.ts')) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: parse-entity.ts <entity-file>');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(parseEntity(arg), null, 2) + '\n');
}
