// ==================== 高性能逆波兰表达式解析引擎 ====================
const OPERATORS = {
  '+': { prec: 2, assoc: 'L' },
  '-': { prec: 2, assoc: 'L' },
  '*': { prec: 3, assoc: 'L' },
  '/': { prec: 3, assoc: 'L' },
  '^': { prec: 4, assoc: 'R' }
};
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'abs', 'sqrt', 'exp', 'log']);

class MathParser {
  static preprocess(expr) {
    let s = expr.toLowerCase().replace(/\s+/g, '');
    
    // 1. 一元负号转换 (将开头的负号或括号内的负号安全转换为标准的 0- 模式，避免与二元运算符冲突)
    if (s.startsWith('-')) {
      s = '0' + s;
    }
    s = s.replace(/\(-/g, '(0-');

    // 2. 智能前缀系数自动补全 
    // 开头是乘除号，补 1
    if (s.startsWith('*') || s.startsWith('/')) {
      s = '1' + s;
    } 
    // 开头是幂运算符号，补自变量 x
    else if (s.startsWith('^')) {
      s = 'x' + s;
    }
    
    // 括号内的起始操作符智能补全，例如 (*x) -> (1*x) 或 (^2) -> (x^2)
    s = s.replace(/\(\*/g, '(1*');
    s = s.replace(/\(\//g, '(1/');
    s = s.replace(/\(\^/g, '(x^');

    // 3. 自动隐式乘法处理
    s = s.replace(/(\d)(x)/g, '$1*$2');
    s = s.replace(/(x)(\()/g, '$1*$2');
    s = s.replace(/(\))x/g, '$1*x');
    s = s.replace(/(\))(\()/g, '$1*$2');
    s = s.replace(/(\d)(\()/g, '$1*$2');
    s = s.replace(/(\))(\d)/g, '$1*$2');
    
    // 4. 常数支持
    s = s.replace(/\bpi\b/g, Math.PI.toString());
    s = s.replace(/\be\b/g, Math.E.toString());
    return s;
  }

  static tokenize(expression) {
    const tokens = [];
    let i = 0;
    const src = this.preprocess(expression);

    while (i < src.length) {
      const char = src[i];

      if (/[0-9.]/.test(char)) {
        let numStr = '';
        while (i < src.length && /[0-9.]/.test(src[i])) {
          numStr += src[i++];
        }
        tokens.push({ type: 'NUMBER', value: numStr });
        continue;
      }

      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }

      if (char in OPERATORS) {
        tokens.push({ type: 'OPERATOR', value: char });
        i++;
        continue;
      }

      if (/[a-zA-Z]/.test(char)) {
        let name = '';
        while (i < src.length && /[a-zA-Z]/.test(src[i])) {
          name += src[i++];
        }
        if (name === 'x') {
          tokens.push({ type: 'VARIABLE', value: 'x' });
        } else if (FUNCTIONS.has(name)) {
          tokens.push({ type: 'FUNCTION', value: name });
        } else {
          throw new Error(`未知数学符号: "${name}"`);
        }
        continue;
      }
      throw new Error(`无法解析的字符: "${char}"`);
    }
    return tokens;
  }

  static compile(expression) {
    const tokens = this.tokenize(expression);
    const outputQueue = [];
    const operatorStack = [];

    for (const token of tokens) {
      if (token.type === 'NUMBER' || token.type === 'VARIABLE') {
        outputQueue.push(token);
      } else if (token.type === 'FUNCTION') {
        operatorStack.push(token);
      } else if (token.type === 'OPERATOR') {
        let top = operatorStack[operatorStack.length - 1];
        while (
          top &&
          (top.type === 'FUNCTION' ||
            (top.type === 'OPERATOR' &&
              (OPERATORS[token.value].assoc === 'L'
                ? OPERATORS[token.value].prec <= OPERATORS[top.value].prec
                : OPERATORS[token.value].prec < OPERATORS[top.value].prec)))
        ) {
          outputQueue.push(operatorStack.pop());
          top = operatorStack[operatorStack.length - 1];
        }
        operatorStack.push(token);
      } else if (token.type === 'LPAREN') {
        operatorStack.push(token);
      } else if (token.type === 'RPAREN') {
        let top = operatorStack[operatorStack.length - 1];
        while (top && top.type !== 'LPAREN') {
          outputQueue.push(operatorStack.pop());
          top = operatorStack[operatorStack.length - 1];
        }
        if (!top) {
          throw new Error("圆括号不匹配，缺少左括号 '('");
        }
        operatorStack.pop(); // 弹掉 '('
        if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === 'FUNCTION') {
          outputQueue.push(operatorStack.pop());
        }
      }
    }

    while (operatorStack.length > 0) {
      const top = operatorStack.pop();
      if (top.type === 'LPAREN' || top.type === 'RPAREN') {
        throw new Error("检测到左右圆括号不匹配！");
      }
      outputQueue.push(top);
    }
    return outputQueue;
  }

  static evaluate(rpn, xVal) {
    const stack = [];
    for (const token of rpn) {
      if (token.type === 'NUMBER') {
        stack.push(parseFloat(token.value));
      } else if (token.type === 'VARIABLE') {
        stack.push(xVal);
      } else if (token.type === 'OPERATOR') {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error("语法不完整，操作数缺失");
        switch (token.value) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(b === 0 ? 0 : a / b); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
      } else if (token.type === 'FUNCTION') {
        const arg = stack.pop();
        if (arg === undefined) throw new Error("函数参数缺失");
        switch (token.value) {
          case 'sin': stack.push(Math.sin(arg)); break;
          case 'cos': stack.push(Math.cos(arg)); break;
          case 'tan': stack.push(Math.tan(arg)); break;
          case 'abs': stack.push(Math.abs(arg)); break;
          case 'sqrt': stack.push(arg < 0 ? 0 : Math.sqrt(arg)); break;
          case 'exp': stack.push(Math.exp(arg)); break;
          case 'log': stack.push(arg <= 0 ? 0 : Math.log(arg)); break;
        }
      }
    }
    if (stack.length !== 1) throw new Error("表达式不合法，有多余操作数");
    return stack[0];
  }
}