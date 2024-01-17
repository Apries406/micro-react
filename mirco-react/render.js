// * 下一个工作单元
let nextUnitOfWork = null
// * 首个工作单元
let workInProgressRoot = null
// * 上个Fiber (为Diff算法提供帮助)
let currentRoot = null
// * 记录删除的Fiber
let deletions = null

function createDom(element) {
	const dom =
		element.type === 'TEXT_ELEMENT'
			? document.createTextNode('')
			: document.createElement(element.type)

	// * 赋予属性

	// * 排除掉children属性
	const isProperty = (key) => key !== 'children'

	Object.keys(element.props)
		.filter(isProperty)
		.forEach((name) => {
			dom[name] = element.props[name]
		})

	// * 递归渲染子元素
	// ! 一旦开始渲染，我们就不会停止，直到渲染出完整的元素树。如果元素树很大，可能会阻塞主线程太长时间。如果浏览器需要执行高优先级的操作，例如处理用户输入或保持动画流畅，则必须等到渲染完成.
	// element.props.children.forEach((child) => render(child, dom))

	// todo: 因此，我们将把工作分成小单元，完成每个单元后，如果还有其他需要完成的事情，我们将让浏览器中断渲染。(工作曲线) (fiber conciler)
	return dom
}

function render(element, container) {
	// * 创建首个fiber
	workInProgressRoot = {
		dom: container,
		props: {
			children: [element],
		},
		alterNate: currentRoot, // * 指向上个Fiber
		child: null, // * 指向第一个子fiber
		sibiling: null, // * 指向兄弟fiber
		parent: null, // * 指向父fiber
	}

	deletions = []
	nextUnitOfWork = workInProgressRoot
}

// ? requestIdleCallback window.requestIdleCallback() 方法插入一个函数，这个函数将在浏览器空闲时期被调用。这使开发者能够在主事件循环上执行后台和低优先级工作，而不会影响延迟关键事件，如动画和输入响应。函数一般会按先进先调用的顺序执行，然而，如果回调函数指定了执行超时时间timeout，则有可能为了在超时前执行函数而打乱执行顺序。你可以在空闲回调函数中调用 requestIdleCallback()，以便在下一次通过事件循环之前调度另一个回调。参数 callback 一个在事件循环空闲时即将被调用的函数的引用。函数会接收到一个名为 IdleDeadline 的参数，这个参数可以获取当前空闲时间以及回调是否在超时时间前已经执行的状态。options 可选包括可选的配置参数。具有如下属性：timeout：如果指定了 timeout，并且有一个正值，而回调在 timeout 毫秒过后还没有被调用，那么回调任务将放入事件循环中排队，即使这样做有可能对性能产生负面影响。返回值一个 ID，可以把它传入 Window.cancelIdleCallback() 方法来结束回调。

function commitRoot() {
	// * 处理删除的Fiber
	deletions.forEach(commitWork)
	// * 提交Fiber树
	commitWork(workInProgressRoot.child)
	// * 清空工作进度, 保留上一次的Fiber
	currentRoot = workInProgressRoot
	workInProgressRoot = null
}

function commitWork(fiber) {
	if (!fiber) {
		// * 无任务可提交
		return
	}
	let domParentFiber = fiber.parent
	while (!domParentFiber.dom) {
		domParentFiber = domParentFiber.parent
	}
	const domParent = domParentFiber.dom
	if (fiber.effectTag === 'PLACEMENT' && fiber.dom) {
		domParent.appendChild(fiber.dom)
	} else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
		updateDom(fiber.dom, fiber.alterNate.props, fiber.props)
	} else if (fiber.effectTag === 'DELETION') {
		commitDeletion(fiber, domParent)
	}

	commitWork(fiber.child)
	commitWork(fiber.sibling)
}
function commitDeletion(fiber, domParent) {
	if (fiber.dom) {
		domParent.removeChild(fiber.dom)
	} else {
		commitDeletion(fiber.child, domParent)
	}
}
const isEvent = (key) => key.startsWith('on') // * 监听事件
const isProperty = (key) => key !== 'children' && !isEvent(key)
const isNew = (prev, next) => (key) => prev[key] !== next[key]
const isGone = (prev, next) => (key) => !(key in next)

function updateDom(dom, prevProps, nextProps) {
	// * 删除监听函数
	Object.keys(prevProps)
		.filter(isEvent)
		.filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
		.filter(isGone(prevProps, nextProps))
		.forEach((name) => {
			const eventType = name.toLowerCase().substring(2)
			dom.removeEventListener(eventType, prevProps[name])
		})

	// * 	删除不再存在的Props
	Object.keys(prevProps)
		.filter(isProperty)
		.filter(isGone(prevProps, nextProps))
		.forEach((name) => {
			dom[name] = ''
		})

	// *
	Object.keys(nextProps)
		.filter(isEvent)
		.filter(isNew(prevProps, nextProps))
		.forEach((name) => {
			const eventType = name.toLowerCase().substring(2)
			dom.addEventListener(eventType, nextProps[name])
		})

	// * 赋予新的或者改变的Props
	Object.keys(nextProps)
		.filter(isProperty)
		.filter(isNew(prevProps, nextProps))
		.forEach((name) => {
			dom[name] = nextProps[name]
		})
}
// * 工作调度
function workLoop(deadline) {
	// * 是否应当退出当前工作循环
	let shouldYield = false

	while (nextUnitOfWork && !shouldYield) {
		// * 执行渲染工作，并更新为下一次工作
		nextUnitOfWork = performUnitOfWork(nextUnitOfWork)

		// * 检查是否有剩余时间 (1ms) 若无，则让出主线程
		shouldYield = deadline.timeRemaining() < 1
	}

	if (!nextUnitOfWork && workInProgressRoot) {
		// * 当无下一个工作单元，且有工作进度时，说明渲染完成
		// * 提交整个Fiber树用于构建真实DOM树
		commitRoot()
	}

	// * 等浏览器有剩余时间，继续渲染
	requestIdleCallback(workLoop)
}

// * 第一次请求线程进行工作循环
requestIdleCallback(workLoop)

let wipFiber = null // * 上一次的fiber
let hookIndex = null

function updateFunctionComponent(fiber) {
	wipFiber = fiber
	hookIndex = 0 // * 正在处理的hook索引
	wipFiber.hooks = []
	const children = [fiber.type(fiber.props)]
	reconcileChildren(fiber, children)
}

export function useState(init) {
	const oldHook =
		wipFiber.alterNate &&
		wipFiber.alterNate.hooks &&
		wipFiber.alterNate.hooks[hookIndex]

	const hook = {
		state: oldHook ? oldHook.state : init,
		queue: [],
	}

	const actions = oldHook ? oldHook.queue : []
	actions.forEach((action) => (hook.state = action(hook.state)))

	const setState = (action) => {
		hook.queue.push(action)
		workInProgressRoot = {
			dom: currentRoot.dom,
			props: currentRoot.props,
			alterNate: currentRoot,
		}

		nextUnitOfWork = workInProgressRoot
		deletions = []
	}
	wipFiber.hooks.push(hook)
	hookIndex++
	return [hook.state, setState]
}

function updateHostComponent(fiber) {
	if (!fiber.dom) {
		fiber.dom = createDom(fiber)
	}

	reconcileChildren(fiber, fiber.props.children)
}

function performUnitOfWork(fiber) {
	// * 函数式组件
	const isFunctionComponent = fiber.type instanceof Function

	if (isFunctionComponent) {
		updateFunctionComponent(fiber)
	} else {
		// TODO: Add Dom Node
		updateHostComponent(fiber)
	}

	// * 子 ->兄 -> 父
	// * 做三件事情

	// * 我们这里还有另一个问题。
	// *每次处理元素时，我们都会向 DOM 添加一个新节点。而且，请记住，在我们完成整个树的渲染之前，浏览器可能会中断我们的工作。在这种情况下，用户将看到不完整的 UI。我们不希望这样
	// if (fiber.parent) {
	// 	fiber.parent.dom.appendChild(fiber.dom)
	// }

	// TODO: Return Next Unit Of Work
	if (fiber.child) {
		return fiber.child
	}
	// * 没有子fiber
	let nextFiber = fiber
	while (nextFiber) {
		// * 有无兄弟
		if (nextFiber.sibling) {
			return nextFiber.sibling
		}
		// * 无兄弟
		nextFiber = nextFiber.parent
		// * 向上查找到Root后，Root无父无兄，结束
	}
}

function reconcileChildren(wipFiber, elements) {
	let index = 0

	// * 首个oldFiber是wipFiber的子节点
	let oldFiber = wipFiber.alterNate && wipFiber.alterNate.child
	let prevSibling = null

	// * 构建了Fiber Tree
	while (index < elements.length || oldFiber != null) {
		let newFiber = null
		const element = elements[index]
		// * 当前React使用的是Key
		const sameType = oldFiber && element && element.type == oldFiber.type

		if (sameType) {
			// TODO: update the node
			newFiber = {
				type: oldFiber.type,
				props: element.props,
				dom: oldFiber.dom,
				parent: wipFiber,
				alterNate: oldFiber,
				effectTag: 'UPDATE', // * 记录类型
			}
		}

		if (element && !sameType) {
			// TODO: add this node
			newFiber = {
				type: element.type,
				props: element.props,
				dom: null,
				parent: wipFiber,
				alterNate: null, // * 新建无旧Fiber
				effectTag: 'PLACEMENT', // * 记录类型
			}
		}

		if (oldFiber && !sameType) {
			// TODO: remove the oldFiber's node
			oldFiber.effectTag = 'DELETION' // * 记录类型
			deletions.push(oldFiber) // * 记录删除的Fiber
		}

		if (oldFiber) {
			// * 通过兄弟fiber遍历Fiber Tree
			oldFiber = oldFiber.sibling
		}

		if (index === 0) {
			// * 如果是亲子节点
			wipFiber.child = newFiber
		} else if (element) {
			prevSibling.sibling = newFiber
		}

		prevSibling = newFiber
		index++
	}
}
export default render
