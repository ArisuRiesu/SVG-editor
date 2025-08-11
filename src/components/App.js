// components/App.js
const template = document.createElement('template'); // Создаём HTML-шаблон
template.innerHTML = `
<style>
    :host {
        display: block;
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
    }
    /* ... rest of your styles ... */
</style>
<div class="buffer-zone">
    <buffer-zone></buffer-zone>
</div>
<div class="work-zone-container">
    <div class="y-axis axis"></div>
    <div class="x-axis axis"></div>
    <work-zone class="work-zone"></work-zone>
</div>
`;
// Объявляем класс веб-компонента SvgApp
class SvgApp extends HTMLElement {
    constructor() { // Конструктор класса
        super(); // Вызываем конструктор родителя HTMLElement
        this.attachShadow({ mode: 'open' }); // Включаем теневой DOM
        this.shadowRoot.appendChild(template.content.cloneNode(true));  // Клонируем и добавляем шаблон в shadow DOM
    }

    connectedCallback() { // Вызывается, когда элемент добавлен в DOM
        // Инициализируем зоны и кнопки                                                                                         
        setTimeout(() => {
            this.bufferZone = this.shadowRoot.querySelector('buffer-zone'); // Находим buffer-zone внутри shadow DOM
            this.workZone = this.shadowRoot.querySelector('work-zone'); // Находим work-zone внутри shadow DOM
            this.setupControls(); // Настраиваем кнопки управления
        }, 0);
    }

     setupControls() { // Метод настройки кнопок
        const createBtn = document.getElementById('createBtn'); 
        const saveBtn = document.getElementById('saveBtn');
        const resetBtn = document.getElementById('resetBtn');

        // Добавляем обработчики событий с проверкой на null
        createBtn?.addEventListener('click', () => { 
            this.bufferZone?.createPolygons?.(); // Вызываем метод создания полигонов в buffer-zone
        });


        saveBtn?.addEventListener('click', () => {
            const workspace = this.shadowRoot.querySelector('work-zone'); // Находим рабочую зону
            workspace?.saveToLocalStorage?.(); // Сохраняем данные в localStorage
        });

        resetBtn?.addEventListener('click', () => {
            localStorage.removeItem('savedPolygons'); // Удаляем сохранённые полигоны из localStorage
            const workspace = this.shadowRoot.querySelector('work-zone');  // Находим рабочую зону
            workspace?.reset?.(); // Сбрасываем рабочую зону
        });

        // Если рабочая зона готова, загружаем сохранённые данные
        if (this.workZone && this.workZone._isConnected) { // Проверяем, что рабочая зона подключена
            this.workZone.loadFromLocalStorage(); // Загружаем сохранённые полигоны
        }
    }
}

if (!customElements.get('svg-app')) {
    customElements.define('svg-app', SvgApp);
}