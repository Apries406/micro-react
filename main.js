import { createElement, render, useState } from './mirco-react'
function Counter() {
	const [state, setState] = useState(0)

	return createElement(
		'h1',
		{ onclick: () => setState((prev) => prev + 1) },
		state
	)
}

const container = document.querySelector('#root')
const element = createElement(Counter)

render(element, container)
