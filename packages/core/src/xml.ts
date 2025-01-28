export type TextNode = {
  type: 'text';
  content: string;
  parent?: Node;
  children?: never;
};

export type ElementNode<
  Attributes extends Record<string, string> = Record<string, any>,
> = {
  type: 'element';
  name: string;
  attributes: Attributes;
  content: string;
  parent?: Node;
  children?: Node[];
  closed?: true;
};

export type Node = TextNode | ElementNode;

export type NodeVisitor = (node: Node, parse: () => Node[]) => Node;

export class XMLParser {
  private parseAttributes(text: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const matches = text.matchAll(/(\w+)="([^"]*)"/g);
    for (const match of matches) {
      attrs[match[1]] = match[2];
    }
    return attrs;
  }

  public parse(
    text: string,
    visitor: NodeVisitor,
    depth = 0,
    parent: Node | undefined = undefined
  ): Node[] {
    const nodes: Node[] = [];

    let workingText = text.trim();

    while (workingText.length > 0) {
      // console.log({ depth, workingText });

      // Find first opening tag
      const tagStart = workingText.indexOf('<');
      if (tagStart === -1) {
        const textNode: TextNode = {
          type: 'text',
          content: workingText.trim(),
        };
        nodes.push(visitor(textNode, () => []));
        break;
      }

      if (tagStart > 0) {
        const textNode: TextNode = {
          type: 'text',
          content: workingText.slice(0, tagStart).trim(),
        };
        nodes.push(visitor(textNode, () => []));
      }

      // Find end of opening tag
      const tagEnd = workingText.indexOf('>', tagStart);
      if (tagEnd === -1) break;

      // Parse tag and attributes
      const tagContent = workingText.slice(tagStart + 1, tagEnd);
      const [name, ...attrParts] = tagContent.split(' ');
      const attributes = this.parseAttributes(attrParts.join(' '));

      // Skip if it's a closing tag
      if (workingText[tagEnd - 1] === '/') {
        workingText = workingText.slice(tagEnd + 1).trim();
        nodes.push(
          visitor(
            {
              type: 'element',
              name,
              attributes,
              content: '',
              closed: true,
            },
            () => []
          )
        );
        continue;
      }

      // console.log({ name, attrParts });
      // Find last matching close tag
      const closeTag = `</${name}>`;
      const closePos = workingText.lastIndexOf(closeTag);
      if (closePos === -1) break;

      // Extract content between tags
      const content = workingText.slice(tagEnd + 1, closePos).trim();

      const node: ElementNode = {
        type: 'element',
        name,
        attributes,
        content,
      };

      if (parent) node.parent = parent;

      nodes.push(
        visitor(node, () => this.parse(content, visitor, depth + 1, node))
      );

      // Continue with remaining text before this tag
      workingText = workingText.slice(closePos + closeTag.length).trim();
    }
    return nodes;
  }
}

// const xml = `
// <output>
// <action name="yoo" />
// <analysis msgId="123">
// This is raw content
// </analysis>
// <action name="test">{"key": "value"}</action>
// <response msgId="123">
// hi how are u today
// yoooo
// </response>
// </output>
// `;

// const parser = new XMLParser();

// const nodes = parser.parse(xml, (node, parse) => {
//   switch (node.name) {
//     case "output":
//       return {
//         ...node,
//         children: parse(),
//       };
//     case "action":
//       break;
//     case "response":
//       break;
//   }

//   return node;
// });

// for (const element of nodes[0].children ?? []) {
//   console.log(element);
// }
