import { ZodType } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { Node, ElementNode, XMLParser } from './xml';
import { Pretty, RuntimeData } from './types';

export type ExtractTemplateVariables<T extends string> =
  T extends `${infer Start}{{${infer Var}}}${infer Rest}`
  ? Var | ExtractTemplateVariables<Rest>
  : never;

export type TemplateVariables<T extends string> = Pretty<{
  [K in ExtractTemplateVariables<T>]: string;
}>;

export type Formatter<
  Variables extends Record<string, any> = Record<string, any>,
  Data = any,
> = (vars: Variables, data: Data) => Record<keyof Variables, any>;

export type InferFormatter<TPrompt extends AnyPrompt> =
  TPrompt extends Prompt<infer Variables, any, infer Data>
  ? Formatter<Variables, Data>
  : never;

export type PromptVisitor<
  Output = any,
  Attributes extends Record<string, any> = Record<string, any>,
> = (
  output: Output,
  node: ElementNode<Attributes>,
  parse: () => Node[]
) => void;

export type GetVisitors<
  Output = any,
  T extends Record<string, Record<string, any>> = Record<
    string,
    Record<string, any>
  >,
> = {
    [K in keyof T]: PromptVisitor<Output, T[K]>;
  };

export type Prompt<
  Variables extends Record<string, any>,
  Components extends Record<string, Record<string, any>>,
  Data extends Record<any, any> = Record<any, any>,
> = {
  render: <TData extends Data>(
    vars: Variables,
    data: TData,
    formatter?: Formatter<Variables, TData>
  ) => string;

  parse: <Output, Visitors extends GetVisitors<Output, Components>>(
    response: string,
    visitors: Visitors,
    output: Output
  ) => Output;
};

export type AnyPrompt = Prompt<any, any, any>;

export type InferPromptVariables<TPrompt extends AnyPrompt> =
  TPrompt extends Prompt<infer Vars, any> ? Vars : never;

export type InferPromptData<TPrompt extends AnyPrompt> =
  TPrompt extends Prompt<any, any, infer Data> ? Data : never;

export type GeneratePromptConfig<
  TPrompt extends AnyPrompt | string = any,
  Variables extends Record<string, any> = any,
  Data = Record<string, any>,
  TFormatter extends Formatter<Variables, Data> = Formatter<Variables, Data>,
> = {
  template: TPrompt;
  variables: Variables;
  data: Data;
  formatter?: TFormatter;
};

export type InferGeneratePromptConfig<TPrompt extends AnyPrompt | string> =
  | (TPrompt extends Prompt<infer Variables, any, infer Data>
    ? GeneratePromptConfig<TPrompt, Variables, Data>
    : never)
  | (TPrompt extends string
    ? GeneratePromptConfig<TPrompt, TemplateVariables<TPrompt>>
    : never);

export type InferPromptComponents<TPrompt extends AnyPrompt | string> =
  TPrompt extends Prompt<any, infer Components> ? Components : never;

export type InferPromptVisitors<TPrompt extends AnyPrompt> =
  TPrompt['parse'] extends (
    response: string,
    visitors: infer Visitors,
    initialOutput: any
  ) => any
  ? Visitors
  : never;

export const parser = new XMLParser();

function formatValue(value: any) {
  if (Array.isArray(value)) return value.map((t) => formatValue(t)).join('\n');
  if (typeof value !== 'string') return JSON.stringify(value);
  return value;
}

export function template<Template extends string>(
  str: Template,
  data: TemplateVariables<Template>
) {
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    formatValue(data[key] ?? '')
  );
}

export function getZodJsonSchema(schema: ZodType<any>) {
  return zodToJsonSchema(schema, 'schema').definitions!.schema;
}

// todo: rename this
export function loadPrompt<
  Variables extends Record<string, any>,
  Components extends Record<string, Record<string, any>>,
  Data extends RuntimeData = RuntimeData,
>(
  prompt: string,
  baseFormatter?: Formatter<Variables, Data>
): Prompt<Variables, Components, Data> {
  return createPrompt(prompt, baseFormatter);
}

export function createPrompt<
  Components extends Record<string, Record<string, any>> = Record<
    string,
    Record<string, any>
  >,
  Data extends RuntimeData = RuntimeData,
  Template extends string = string,
  Variables extends TemplateVariables<Template> = TemplateVariables<Template>,
>(
  prompt: Template,
  baseFormatter?: Formatter<Variables, Data>
): Prompt<Variables, Components, Data> {
  return {
    render(vars, data, formatter) {
      return template(
        prompt,
        formatter
          ? formatter(vars, data)
          : baseFormatter
            ? baseFormatter(vars, data)
            : vars
      );
    },
    parse: (response, visitors, output) => {
      parser.parse(response, (node, parse) => {
        if (node.type === 'element' && node.name in visitors) {
          visitors[node.name](output, node as ElementNode<any>, parse);
        }
        return node;
      });

      return output;
    },
  };
}
