class PolygonEditor extends HTMLElement {  // Создаём кастомный HTML-элемент <polygon-editor>
  constructor() { // Конструктор класса
    super(); // Вызываем конструктор родителя HTMLElement

    // Включаем теневой DOM для изоляции структуры и стилей
    this.attachShadow({ mode: 'open' });

    // Параметры состояния
    this.scale = 1;                  // Текущий масштаб (для зума)
    this.offset = { x: 0, y: 0 };     // Смещение "мира" по X и Y (для панорамирования)
    this.isPanning = false;           // Флаг: двигаем ли мы сейчас картинку

    // Контейнер для SVG
    const container = document.createElement('div'); 
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

    // Создаём SVG для отрисовки сетки и полигонов
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.transformOrigin = '0 0'; // Масштабируем относительно нижнего левого угла
    svg.style.cursor = 'grab';         // Курсор "рука" по умолчанию
    svg.style.userSelect = 'none';     // Запрещаем выделение текста при панорамировании

    this.svg = svg; // Сохраняем для доступа из других методов

    // Создаём два слоя: сетка и полигоны
    this.gridLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.polygonLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Добавляем слои в SVG
    this.svg.appendChild(this.gridLayer);
    this.svg.appendChild(this.polygonLayer);

    // Добавляем SVG в контейнер и контейнер в теневой DOM
    container.appendChild(svg);
    this.shadowRoot.appendChild(container);

    this.draggingPolygon = null;
    this.dragOffset = { x: 0, y: 0 };


    // Подключаем обработчики событий
    this._bindEvents();

    // Рисуем стартовую сетку
    this._drawGrid();
  }

  // Подключение обработчиков событий
  _bindEvents() {
    this.svg.addEventListener('dragover', (e) => e.preventDefault());  // Разрешаем drag-over
    this.svg.addEventListener('drop', this._onDrop.bind(this));        // Обработка drop полигона
    this.svg.addEventListener('wheel', this._onZoom.bind(this), { passive: false }); // Зум колесом мыши
    this.svg.addEventListener('mousedown', this._onMouseDown.bind(this)); // Начало панорамирования
    this.svg.addEventListener('mousemove', this._onMouseMove.bind(this)); // Перемещение при панорамировании
    this.svg.addEventListener('mouseup', this._onMouseUp.bind(this));     // Конец панорамирования
    this.svg.addEventListener('mousedown', this._onPolygonMouseDown.bind(this));
    this.svg.addEventListener('mousemove', this._onPolygonMouseMove.bind(this));
    this.svg.addEventListener('mouseup', this._onPolygonMouseUp.bind(this));
    this.svg.addEventListener('mouseleave', this._onPolygonMouseUp.bind(this));
  }

  // Обработка события "Drop" — вставка полигона
  _onDrop(e) {
    e.preventDefault();

    const points = e.dataTransfer.getData('text/plain'); // Получаем координаты из Drag&Drop
    if (!points) return;

    // Шаг 1️ Конвертируем координаты курсора из клиентских в мировые координаты SVG
    const rect = this.svg.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / this.scale - this.offset.x;
    const svgY = (e.clientY - rect.top) / this.scale - this.offset.y;

    // Шаг 2️ Разбираем исходные точки полигона
    const parsedPoints = points.trim().split(' ').map(p => {
      const [x, y] = p.split(',').map(Number);
      return { x, y };
    });

    // Шаг 3️ Находим центр полигона и вычисляем смещение
    const minX = Math.min(...parsedPoints.map(p => p.x));
    const minY = Math.min(...parsedPoints.map(p => p.y));
    const maxX = Math.max(...parsedPoints.map(p => p.x));
    const maxY = Math.max(...parsedPoints.map(p => p.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const dx = svgX - centerX;
    const dy = svgY - centerY;

    // Шаг 4️ Генерируем новые координаты с учётом смещения
    const newPoints = parsedPoints.map(p => `${p.x + dx},${p.y + dy}`).join(' ');

    // Шаг 5️ Создаём новый SVG-полигон
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', newPoints);
    poly.setAttribute('fill', 'crimson');
    poly.setAttribute('stroke', '#000');
    poly.setAttribute('stroke-width', '1');

    this.polygonLayer.appendChild(poly);
  }

  // Обработка зума колесом мыши
  _onZoom(e) {
    e.preventDefault();
    const zoomFactor = 1.1; // Коэффициент зума

    if (e.deltaY < 0) {
      this.scale *= zoomFactor; // Увеличение масштаба
    } else {
      this.scale /= zoomFactor; // Уменьшение масштаба
    }

    // Ограничиваем масштаб
    this.scale = Math.max(0.1, Math.min(this.scale, 10));

    this._applyTransform(); // Применяем масштаб
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

    // Вычисляем новый оффсет
    let newOffsetX = this.offset.x + dx / this.scale;
    let newOffsetY = this.offset.y + dy / this.scale;

    // Запрещаем уходить в отрицательные мировые координаты
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

  // Применяем смещение и масштаб
  _applyTransform() {
    // Применяем трансформацию только к полигонному слою
    const transform = `translate(${this.offset.x}, ${this.offset.y}) scale(${this.scale})`;
    this.polygonLayer.setAttribute('transform', transform);

    // Слой сетки оставляем без трансформации
    this.gridLayer.removeAttribute('transform');

    // Перерисовываем сетку для нового масштаба
    this._drawGrid();
  }

   _onPolygonMouseDown(e) {
    if (e.target.tagName === 'polygon') {
      e.preventDefault();
      e.stopPropagation();
      
      // Convert mouse position to SVG coordinates
      const rect = this.svg.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / this.scale - this.offset.x;
      const mouseY = (e.clientY - rect.top) / this.scale - this.offset.y;
      
      // Get polygon points
      const points = e.target.getAttribute('points')
        .split(' ')
        .map(p => {
          const [x, y] = p.split(',').map(Number);
          return { x, y };
        });
      
      // Find the closest point to determine offset
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


  _onPolygonMouseMove(e) {
    if (!this.draggingPolygon) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Convert mouse position to SVG coordinates
    const rect = this.svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / this.scale - this.offset.x;
    const mouseY = (e.clientY - rect.top) / this.scale - this.offset.y;
    
    // Calculate new position
    const newX = mouseX - this.dragOffset.x;
    const newY = mouseY - this.dragOffset.y;
    
    // Get current points
    const points = this.draggingPolygon.getAttribute('points')
      .split(' ')
      .map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
    
    // Calculate center of polygon
    const center = points.reduce((acc, p) => {
      return { x: acc.x + p.x / points.length, y: acc.y + p.y / points.length };
    }, { x: 0, y: 0 });
    
    // Calculate translation vector
    const dx = newX - center.x;
    const dy = newY - center.y;
    
    // Generate new points
    const newPoints = points.map(p => `${p.x + dx},${p.y + dy}`).join(' ');
    
    // Update polygon
    this.draggingPolygon.setAttribute('points', newPoints);
  }

    _onPolygonMouseUp(e) {
    if (this.draggingPolygon) {
      this.draggingPolygon = null;
      this.svg.style.cursor = 'grab';
    }
  }

  // Отрисовка сетки и осей
  _drawGrid() {
    const spacing = 50; // Шаг сетки в мировых координатах
    const width = this.svg.clientWidth;
    const height = this.svg.clientHeight;

    this.gridLayer.innerHTML = ''; // Очищаем слой сетки

    // Определяем видимые границы в мировых координатах
    const worldLeft = -this.offset.x;
    const worldTop = -this.offset.y;
    const worldRight = worldLeft + width / this.scale;
    const worldBottom = worldTop + height / this.scale;

    // Вертикальные линии сетки
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

    // Горизонтальные линии сетки
    let startY = Math.floor(worldTop / spacing) * spacing;
    let endY = Math.ceil(worldBottom / spacing) * spacing;
    for (let y = startY; y <= endY; y += spacing) {
      const screenY = height - ((y + this.offset.y) * this.scale); // Переворот оси Y
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', screenY);
      line.setAttribute('x2', width);
      line.setAttribute('y2', screenY);
      line.setAttribute('stroke', '#ccc');
      line.setAttribute('stroke-width', '1');
      this.gridLayer.appendChild(line);
    }

    // Серые полосы под осями
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

    // Чёрные линии осей
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

    // Подписи к осям
    for (let x = startX; x <= endX; x += spacing) {
      if (x < 0) continue; // Пропускаем отрицательные значения по X
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

  // Загрузка массива полигонов
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

  // Получение всех полигонов как массива строк с точками
  getPolygons() {
    return Array.from(this.polygonLayer.querySelectorAll('polygon'))
      .map(p => p.getAttribute('points'));
  }

  // Очистка всех полигонов
  clearPolygons() {
    this.polygonLayer.innerHTML = '';
  }
}

// Регистрируем веб-компонент
customElements.define('polygon-editor', PolygonEditor);
