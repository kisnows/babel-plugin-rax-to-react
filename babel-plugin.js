const t = require("@babel/types");
module.exports = function(babel) {
  const { template } = babel;
  function getAttributeValue({ literal, value }) {
    if (typeof value === "boolean") {
      return t.jsxExpressionContainer(t.booleanLiteral(value));
    }

    if (typeof value === "number") {
      return t.jsxExpressionContainer(t.numericLiteral(value));
    }

    if (typeof value === "string" && literal) {
      return t.jsxExpressionContainer(template.ast(value).expression);
    }

    if (typeof value === "string") {
      return t.stringLiteral(value);
    }

    return null;
  }

  function replaceStyle(path) {
    if (!path.parentPath.parent.name) return;
    path.parentPath.parent.name.name = "className";
  }

  function getRenderPath(path) {
    return path.findParent(path => {
      if (t.isClassMethod(path) || t.isFunction(path)) {
        return true;
      }
    });
  }

  function getReturnPath(path) {
    return path.findParent(path => {
      if (t.isReturnStatement(path)) {
        return true;
      }
    });
  }
  function buildStyleScript(styleUidName, styles) {
    const test = t.callExpression(
      t.memberExpression(t.identifier("Object"), t.identifier("assign")),
      styles
    );
    const newScript = t.variableDeclaration("const", [
      t.variableDeclarator(styleUidName, test),
    ]);
    return newScript;
  }

  function buildClassNameScript(classNameUid, nodes) {
    // TODO: 构建一个 List ，用来创建 className 字符串
    const array = t.arrayExpression(nodes);
    const call = t.callExpression(
      t.memberExpression(array, t.identifier("join")),
      [t.stringLiteral(" ")]
    );
    const newScript = t.variableDeclaration("const", [
      t.variableDeclarator(classNameUid, call),
    ]);
    return newScript;
  }

  return {
    name: "raxToReact", // not required
    visitor: {
      JSXOpeningElement: {
        enter(path) {
          const node = path.node;
          const styles = [];
          const classNames = [];
          let newStyleAttr = null;
          let newClassNameAttr = null;
          let styleAttrPath = null;

          path.traverse({
            JSXAttribute(path) {
              if (path.node.name.name !== "style") return;
              styleAttrPath = path;
              path.traverse({
                /**
                 * 查找当前 style 的值是否是一个 Array, 仅限查找直接的变量，而非从对象上读取的，
                 * eg: style={[list, obj.arr]} ,则只查找 list 而不管 obj.arr
                 */
                Identifier(identifyPath) {
                  const name = identifyPath.node.name;
                  const parent = identifyPath.parent;
                  if (t.isMemberExpression(parent)) return false;
                  let isArray = false;
                  const par = identifyPath.findParent(p => {
                    if (t.isClassMethod(p) || t.isFunction(p)) {
                      // 从 render  方法里面往下找当前变量的定义，
                      p.traverse({
                        VariableDeclarator(path) {
                          if (
                            t.isArrayExpression(path.node.init) &&
                            path.node.id.name === name
                          ) {
                            isArray = true;
                          }
                        },
                      });
                    }
                  });

                  if (isArray) {
                    // TODO: 如果是 Array ，则重新走一下后面的 ArrayExpression 的处理
                    const arrayStyle = identifyPath.scope.generateUidIdentifier(
                      "arrayStyle"
                    );
                    const preformArrayStyle = template.ast(`
                      const ${arrayStyle.name} = {}
                      ${name}.forEach(sty => {
                      Object.assign(${arrayStyle.name}, sty)
                    })
                    `);
                    const jsxParent = identifyPath.findParent(p => {
                      if (
                        t.isReturnStatement(p) ||
                        t.isVariableDeclaration(p)
                      ) {
                        return true;
                      }
                    });
                    jsxParent.insertBefore(preformArrayStyle);
                    identifyPath.node.name = arrayStyle.name;
                  }
                },
                MemberExpression(path) {
                  replaceStyle(path);
                },
                ArrayExpression(arrayExpressionPath) {
                  const eles = arrayExpressionPath.node.elements;
                  eles.forEach(e => {
                    if (t.isMemberExpression(e)) {
                      classNames.push(e);
                    } else if (t.isObjectExpression(e)) {
                      styles.push(e);
                    } else if (t.isIdentifier(e)) {
                      styles.push(e);
                    }
                  });
                },
              });
            },
          });

          if (!styles.length && !classNames.length) return;
          /**
           * NOTE: 重建样式属性
           * 1. 删除 style 属性节点
           * 2. 用 styles 创建新的 style 节点
           * 3. 用 classNames 创建 className 节点
           */
          const renderPath = getRenderPath(path);
          let returnPath = getReturnPath(path);

          // NOTE: 生成唯一 id ,并插入合并 styles 的代码，
          styleAttrPath.remove();
          if (styles.length) {
            if (!renderPath) return false;
            const styleUid = path.scope.generateUidIdentifier("style_UID");
            const newScript = buildStyleScript(styleUid, styles);
            returnPath.insertBefore(newScript);
            // returnPath.forEach(pa => pa.insertBefore(newScript))
            newStyleAttr = t.jsxAttribute(
              t.jsxIdentifier("style"),
              getAttributeValue({ value: styleUid.name, literal: true })
            );
            path.node.attributes.push(newStyleAttr);
          }
          if (classNames.length) {
            // 构建并插入 className 字段
            if (!renderPath) return;
            const classNameUid = path.scope.generateUidIdentifier(
              "className_UID"
            );
            const newScript = buildClassNameScript(classNameUid, classNames);
            // returnPath.forEach(pa => pa.insertBefore(newScript))
            returnPath.insertBefore(newScript);

            //  构建 className 字符串
            newClassNameAttr = t.jsxAttribute(
              t.jsxIdentifier("className"),
              getAttributeValue({ value: classNameUid.name, literal: true })
            );
            path.node.attributes.push(newClassNameAttr);
          }
        },
      },
    },
  };
};
