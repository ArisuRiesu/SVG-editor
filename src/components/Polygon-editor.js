class PolygonEditor extends HTMLElement {  // Кастомный элемент <polygon-editor>
  constructor() { // Конструктор класса
    super(); // Вызов конструктора родителя HTMLElement

    // Включаем Shadow DOM для изоляции
    this.attachShadow({ mode: 'open' });

    // Параметры состояния
    this.scale = 1;                  // Текущий масштаб
    this.offset = { x: 0, y: 0 };    // Смещение по X и Y
    this.isPanning = false;          // Флаг панорамирования

    // Контейнер для SVG
    const container = document.createElement('div'); 
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

    // Создаем SVG элемент
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.transformOrigin = '0 0'; // Точка трансформации
    svg.style.cursor = 'grab';        // Вид курсора
    svg.style.userSelect = 'none';     // Запрет выделения текста

    this.svg = svg; // Сохраняем ссылку на SVG

    // Создаем слои: сетка и полигоны
    this.gridLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.polygonLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Добавляем слои в SVG
    this.svg.appendChild(this.gridLayer);
    this.svg.appendChild(this.polygonLayer);

    // Добавляем SVG в DOM
    container.appendChild(svg);
    this.shadowRoot.appendChild(container);

    this.draggingPolygon = null;
    this.dragOffset = { x: 0, y: 0 };

    // Настраиваем обработчики событий
    this._bindEvents();

    // Рисуем начальную сетку
    this._drawGrid();
  }

  // Настройка обработчиков событий
  _bindEvents() {
    this.svg.addEventListener('dragover', (e) => e.preventDefault());  // Разрешаем перетаскивание
    this.svg.addEventListener('drop', this._onDrop.bind(this));        // Обработка отпускания
    this.svg.addEventListener('wheel', this._onZoom.bind(this), { passive: false }); // Зум колесом
    this.svg.addEventListener('mousedown', this._onMouseDown.bind(this)); // Начало перемещения
    this.svg.addEventListener('mousemove', this._onMouseMove.bind(this)); // Перемещение
    this.svg.addEventListener('mouseup', this._onMouseUp.bind(this));     // Конец перемещения
    this.svg.addEventListener('mousedown', this._onPolygonMouseDown.bind(this));
    this.svg.addEventListener('mousemove', this._onPolygonMouseMove.bind(this));
    this.svg.addEventListener('mouseup', this._onPolygonMouseUp.bind(this));
    this.svg.addEventListener('mouseleave', this._onPolygonMouseUp.bind(this));
  }

  // Обработка добавления полигона
  _onDrop(e) {
    e.preventDefault();

    const points = e.dataTransfer.getData('text/plain'); // Получаем данные полигона
    if (!points) return;

    // Конвертируем координаты курсора в мировые координаты SVG
    const rect = this.svg.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / this.scale - this.offset.x;
    const svgY = (e.clientY - rect.top) / this.scale - this.offset.y;

    // Парсим точки полигона
    const parsedPoints = points.trim().split(' ').map(p => {
      const [x, y] = p.split(',').map(Number);
      return { x, y };
    });

    // Находим центр полигона
    const minX = Math.min(...parsedPoints.map(p => p.x));
    const minY = Math.min(...parsedPoints.map(p => p.y));
    const maxX = Math.max(...parsedPoints.map(p => p.x));
    const maxY = Math.max(...parsedPoints.map(p => p.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Вычисляем смещение
    const dx = svgX - centerX;
    const dy = svgY - centerY;

    // Генерируем новые координаты
    const newPoints = parsedPoints.map(p => `${p.x + dx},${p.y + dy}`).join(' ');

    // Создаем SVG-полигон
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', newPoints);
    poly.setAttribute('fill', 'crimson');
    poly.setAttribute('stroke', '#000');
    poly.setAttribute('stroke-width', '1');

    this.polygonLayer.appendChild(poly);
  }

  // Обработка зума
  _onZoom(e) {
    e.preventDefault();
    const zoomFactor = 1.1;
    const rect = this.svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Текущая позиция мыши в мировых координатах
    const worldX = mouseX / this.scale - this.offset.x;
    const worldY = mouseY / this.scale - this.offset.y;

    // Применяем зум
    if (e.deltaY < 0) {
        this.scale *= zoomFactor;
    } else {
        this.scale /= zoomFactor;
    }
    this.scale = Math.max(0.1, Math.min(this.scale, 10));

    // Запрещаем отрицательные координаты
    const newOffsetX = Math.min(this.offset.x, 0);
    const newOffsetY = Math.min(this.offset.y, 0);
    
    // Корректируем смещение для центрирования
    this.offset.x = newOffsetX + (mouseX / this.scale - worldX) * (1 - 1/zoomFactor);
    this.offset.y = newOffsetY + (mouseY / this.scale - worldY) * (1 - 1/zoomFactor);

    this._applyTransform();
}

  // Начало панорамирования
  _onMouseDown(e) {
    if (e.target.tagName !== 'polygon') {
      this.isPanning = true;
      this.start = { x: e.clientX, y: e.clientY };
      this.svg.style.cursor = 'grabbing';
    }
  }

  // Перемещение при панорамировании
  _onMouseMove(e) {
    if (!this.isPanning) return;

    const dx = e.clientX - this.start.x;
    const dy = e.clientY - this.start.y;
    this.start = { x: e.clientX, y: e.clientY };

    // Новое смещение
    let newOffsetX = this.offset.x + dx / this.scale;
    let newOffsetY = this.offset.y + dy / this.scale;

    // Запрещаем отрицательные координаты
    newOffsetX = Math.min(newOffsetX, 0);
    newOffsetY = Math.min(newOffsetY, 0);

    this.offset.x = newOffsetX;
    this.offset.y = newOffsetY;

    this._applyTransform();
  }

  // Конец панорамирования
  _onMouseUp() {
    this.isPanning = false;
    this.svg.style.cursor = 'grab';
  }

  // Применение трансформации
_applyTransform() {
    // Трансформация только для слоя полигонов
    const transform = `translate(${this.offset.x}, ${this.offset.y}) scale(${this.scale})`;
    this.polygonLayer.setAttribute('transform', transform);
    
    // Сетка остается без трансформации
    this.gridLayer.removeAttribute('transform');
    
    // Перерисовываем сетку
    this._drawGrid();
}

   // Начало перемещения полигона
   _onPolygonMouseDown(e) {
    if (e.target.tagName === 'polygon') {
      e.preventDefault();
      e.stopPropagation();
      
      // Координаты мыши в системе SVG
      const rect = this.svg.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / this.scale - this.offset.x;
      const mouseY = (e.clientY - rect.top) / this.scale - this.offset.y;
      
      // Получаем точки полигона
      const points = e.target.getAttribute('points')
        .split(' ')
        .map(p => {
          const [x, y] = p.split(',').map(Number);
          return { x, y };
        });
      
      // Находим ближайшую точку для смещения
      let minDist = Infinity;
      points.forEach(p => {
        const dist = Math.sqrt((p.x - mouseX) ** 2 + (p.y - mouseY) ** 2);
        if (dist < minDist) {
          minDist = dist;
          this.dragOffset = { x: mouseX - p.x, y: mouseY - p.y };
        }
      });
      
      this.draggingPolygon = e.target;
      this.svg.style.cursor = 'grabbing';
    }
  }

  // Перемещение полигона
  _onPolygonMouseMove(e) {
    if (!this.draggingPolygon) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Координаты мыши в системе SVG
    const rect = this.svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / this.scale - this.offset.x;
    const mouseY = (e.clientY - rect.top) / this.scale - this.offset.y;
    
    // Новая позиция
    const newX = mouseX - this.dragOffset.x;
    const newY = mouseY - this.dragOffset.y;
    
    // Текущие точки полигона
    const points = this.draggingPolygon.getAttribute('points')
      .split(' ')
      .map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
    
    // Центр полигона
    const center = points.reduce((acc, p) => {
      return { x: acc.x + p.x / points.length, y: acc.y + p.y / points.length };
    }, { x: 0, y: 0 });
    
    // Вектор перемещения
    const dx = newX - center.x;
    const dy = newY - center.y;
    
    // Новые точки полигона
    const newPoints = points.map(p => `${p.x + dx},${p.y + dy}`).join(' ');
    
    // Обновляем полигон
    this.draggingPolygon.setAttribute('points', newPoints);
  }

  // Конец перемещения полигона
    _onPolygonMouseUp(e) {
    if (this.draggingPolygon) {
      this.draggingPolygon = null;
      this.svg.style.cursor = 'grab';
    }
  }

  // Отрисовка сетки
  _drawGrid() {
    const spacing = 50; // Шаг сетки
    const width = this.svg.clientWidth;
    const height = this.svg.clientHeight;

    this.gridLayer.innerHTML = ''; // Очищаем сетку

    // Видимая область в мировых координатах
    const worldLeft = -this.offset.x;
    const worldTop = -this.offset.y;
    const worldRight = worldLeft + width / this.scale;
    const worldBottom = worldTop + height / this.scale;

    // Вертикальные линии
    let startX = Math.floor(worldLeft / spacing) * spacing;
    let endX = Math.ceil(worldRight / spacing) * spacing;
    for (let x = startX; x <= endX; x += spacing) {
      const screenX = (x + this.offset.x) * this.scale;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', screenX);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', screenX);
      line.setAttribute('y2', height);
      line.setAttribute('stroke', '#ccc');
      line.setAttribute('stroke-width', '1');
      this.gridLayer.appendChild(line);
    }

    // Горизонтальные линии
    let startY = Math.floor(worldTop / spacing) * spacing;
    let endY = Math.ceil(worldBottom / spacing) * spacing;
    for (let y = startY; y <= endY; y += spacing) {
      const screenY = height - ((y + this.offset.y) * this.scale);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', screenY);
      line.setAttribute('x2', width);
      line.setAttribute('y2', screenY);
      line.setAttribute('stroke', '#ccc');
      line.setAttribute('stroke-width', '1');
      this.gridLayer.appendChild(line);
    }

    // Фон осей
    const xBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    xBg.setAttribute('x', 0);
    xBg.setAttribute('y', height - 20);
    xBg.setAttribute('width', width);
    xBg.setAttribute('height', 20);
    xBg.setAttribute('fill', '#808080');
    this.gridLayer.appendChild(xBg);

    const yBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    yBg.setAttribute('x', 0);
    yBg.setAttribute('y', 0);
    yBg.setAttribute('width', 40);
    yBg.setAttribute('height', height);
    yBg.setAttribute('fill', '#808080');
    this.gridLayer.appendChild(yBg);

    // Линии осей
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', 0);
    xAxis.setAttribute('y1', height - 0.5);
    xAxis.setAttribute('x2', width);
    xAxis.setAttribute('y2', height - 0.5);
    xAxis.setAttribute('stroke', '#000');
    xAxis.setAttribute('stroke-width', '2');
    this.gridLayer.appendChild(xAxis);

    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', 40);
    yAxis.setAttribute('y1', 0);
    yAxis.setAttribute('x2', 40);
    yAxis.setAttribute('y2', height);
    yAxis.setAttribute('stroke', '#000');
    yAxis.setAttribute('stroke-width', '2');
    this.gridLayer.appendChild(yAxis);

    // Подписи осей
    for (let x = startX; x <= endX; x += spacing) {
      if (x < 0) continue; // Пропускаем отрицательные X
      const screenX = (x + this.offset.x) * this.scale;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', screenX + 2);
      label.setAttribute('y', height - 5);
      label.setAttribute('fill', '#000');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-family', 'Arial, sans-serif');
      label.textContent = Math.round(x);
      this.gridLayer.appendChild(label);
    }

    for (let y = startY; y <= endY; y += spacing) {
      const screenY = height - ((y + this.offset.y) * this.scale);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', 2);
      label.setAttribute('y', screenY - 2);
      label.setAttribute('fill', '#000');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-family', 'Arial, sans-serif');
      label.textContent = Math.round(y);
      this.gridLayer.appendChild(label);
    }
  }

  // Загрузка полигонов
  loadPolygons(pointsArray) {
    this.polygonLayer.innerHTML = '';
    pointsArray.forEach(points => {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', points);
      poly.setAttribute('fill', 'crimson');
      poly.setAttribute('stroke', '#000');
      poly.setAttribute('stroke-width', '1');
      this.polygonLayer.appendChild(poly);
    });
  }

  // Получение всех полигонов
  getPolygons() {
    return Array.from(this.polygonLayer.querySelectorAll('polygon'))
      .map(p => p.getAttribute('points'));
  }

  // Очистка полигонов
  clearPolygons() {
    this.polygonLayer.innerHTML = '';
  }
}

// Регистрация компонента
customElements.define('polygon-editor', PolygonEditor);