# Micro-React

使用 JavaScript 实现的极简 React 框架。

## 目录结构

```
.
├── mirco-react
│   ├── creatElement.js
│   ├── index.js
│   └── render.js
├── index.html
├── main.js
├── package.json
├── Readme.md
└── yarn.lock
```

## 函数实现

### createElement

`createElement(type, props, ...children)`返回一个虚拟节点对象

当节点为文字节点时，特别的使用`createTextElement`来创建其文字虚拟节点

### render

`render(element,container)` 将虚拟节点渲染到页面中

### useState

实现了一个简单的`useState()`Hook
