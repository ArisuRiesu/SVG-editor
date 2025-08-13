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
    this.svg.addEventListener('wheel', this._onZoom.bind(this), { passive: false }); // Зум колесом мыши
    this.svg.addEventListener('mousedown', this._onMouseDown.bind(this)); // Начало панорамирования (перемещения рабочей области)
    this.svg.addEventListener('mousemove', this._onMouseMove.bind(this)); // Обработка движения мыши при панорамировании
    this.svg.addEventListener('mouseup', this._onMouseUp.bind(this));     // Конец панорамирования
    this.svg.addEventListener('mousedown', this._onPolygonMouseDown.bind(this)); // Начало перетаскивания полигона
    this.svg.addEventListener('mousemove', this._onPolygonMouseMove.bind(this)); // Перемещение полигона мышью
    this.svg.addEventListener('mouseup', this._onPolygonMouseUp.bind(this));     // Отпускание полигона
    this.svg.addEventListener('mouseleave', this._onPolygonMouseUp.bind(this));  // Отпускание полигона при выходе мыши за пределы SVG
  }

  // Обработка добавления полигона через drop
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

    // Вычисляем смещение, чтобы центр полигона совпал с точкой drop
    const dx = svgX - centerX;
    const dy = svgY - centerY;

    // Генерируем новые координаты полигона с учетом смещения
    const newPoints = parsedPoints.map(p => `${p.x + dx},${p.y + dy}`).join(' ');

    // Создаем SVG-полигон с новыми координатами
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
    const zoomFactor = 1.03;
    const minScale = 0.3;
    const maxScale = 5;

    if (e.deltaY < 0) {
        this.scale *= zoomFactor;   // Зумируем внутрь
    } else {
        this.scale /= zoomFactor;   // Зумируем наружу
    }
    this.scale = Math.max(minScale, Math.min(this.scale, maxScale)); // Ограничиваем масштаб

    this._centerPolygonsAndScale(); // Центрируем и масштабируем полигоны
    this._drawGrid();               // Перерисовываем сетку
  }

  // Центрирование полигона и применение текущего масштаба
  _centerPolygonsAndScale() {
    const rect = this.svg.getBoundingClientRect();
    const svgCenterX = rect.width / 2;
    const svgCenterY = rect.height / 2;

    // Получаем ограничивающую рамку всех полигонов в мировых координатах
    const polys = Array.from(this.polygonLayer.querySelectorAll('polygon'));
    if (polys.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polys.forEach(poly => {
        const points = poly.getAttribute('points').trim().split(/\s+/).map(p => {
            const [x, y] = p.split(',').map(Number);
            return { x, y };
        });
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Формируем строку трансформации:
    // 1) Перемещаем центр полигона в начало координат
    // 2) Масштабируем
    // 3) Перемещаем к центру SVG области (экрана)
    const translateToOrigin = `translate(${-centerX}, ${-centerY})`;
    const scale = `scale(${this.scale})`;
    const translateToCenter = `translate(${svgCenterX}, ${svgCenterY})`;

    const transform = `${translateToCenter} ${scale} ${translateToOrigin}`;

    this.polygonLayer.setAttribute('transform', transform);
  }

  // Конвертация координат экрана в координаты полигона (мировые)
  _screenToPolygonCoords(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const svgCenterX = rect.width / 2;
    const svgCenterY = rect.height / 2;

    // Конвертируем клиентские координаты в SVG координаты относительно SVG
    const svgX = clientX - rect.left;
    const svgY = clientY - rect.top;

    // Обратное преобразование:
    // Шаг 1: смещаем обратно на центр SVG
    let x = svgX - svgCenterX;
    let y = svgY - svgCenterY;

    // Шаг 2: обратное масштабирование
    x /= this.scale;
    y /= this.scale;

    // Шаг 3: перемещаем обратно на центр полигона (поскольку в трансформации есть translate(-center))
    // Получаем центр полигона
    const polys = Array.from(this.polygonLayer.querySelectorAll('polygon'));
    if (polys.length === 0) return { x: 0, y: 0 };
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polys.forEach(poly => {
        const points = poly.getAttribute('points').trim().split(/\s+/).map(p => {
            const [px, py] = p.split(',').map(Number);
            return { x: px, y: py };
        });
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    x += centerX;
    y += centerY;

    return { x, y };
  }

  // Начало панорамирования (перемещения рабочей области)
  _onMouseDown(e) {
    if (e.target.tagName !== 'polygon') {
      this.isPanning = true;
      this.start = { x: e.clientX, y: e.clientY };
      this.svg.style.cursor = 'grabbing';
    }
  }

  // Обработка движения мыши при панорамировании
  _onMouseMove(e) {
    if (!this.isPanning) return;

    const dx = e.clientX - this.start.x;
    const dy = e.clientY - this.start.y;
    this.start = { x: e.clientX, y: e.clientY };

    // Новое смещение с учетом масштаба
    let newOffsetX = this.offset.x + dx / this.scale;
    let newOffsetY = this.offset.y + dy / this.scale;

    // Запрещаем смещение в положительную сторону (по условию)
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

  // Применение трансформации к полигонам
  _applyTransform() {
    if (!this._center) {
        this._center = { x: 0, y: 0 };
    }

    const rect = this.svg.getBoundingClientRect();
    const svgCenterX = rect.width / 2;
    const svgCenterY = rect.height / 2;

    // Трансформация: сдвигаем к центру SVG, масштабируем, сдвигаем обратно по центру полигона
    const transform = 
      `translate(${svgCenterX}, ${svgCenterY}) scale(${this.scale}) translate(${-this._center.x}, ${-this._center.y})`;

    this.polygonLayer.setAttribute('transform', transform);

    // Сетка не масштабируется, просто перерисовываем её
    this.gridLayer.removeAttribute('transform');
    this._drawGrid();
  }

  // Начало перетаскивания полигона
  _onPolygonMouseDown(e) {
    if (e.target.tagName === 'polygon') {
        e.preventDefault();
        e.stopPropagation();

        const mouse = this._screenToPolygonCoords(e.clientX, e.clientY);

        // Получаем точки полигона
        const points = e.target.getAttribute('points')
            .split(' ')
            .map(p => {
                const [x, y] = p.split(',').map(Number);
                return { x, y };
            });

        // Находим ближайшую точку полигона к курсору для определения смещения при перетаскивании
        let minDist = Infinity;
        points.forEach(p => {
            const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
            if (dist < minDist) {
                minDist = dist;
                this.dragOffset = { x: mouse.x - p.x, y: mouse.y - p.y };
            }
        });

        this.draggingPolygon = e.target;
        this.svg.style.cursor = 'grabbing';
    }
  }

  // Перемещение полигона при перетаскивании
  _onPolygonMouseMove(e) {
    if (!this.draggingPolygon) return;
    e.preventDefault();
    e.stopPropagation();

    const mouse = this._screenToPolygonCoords(e.clientX, e.clientY);

    const newX = mouse.x - this.dragOffset.x;
    const newY = mouse.y - this.dragOffset.y;

    const points = this.draggingPolygon.getAttribute('points')
        .split(' ')
        .map(p => {
            const [x, y] = p.split(',').map(Number);
            return { x, y };
        });

    // Находим центр полигона
    const center = points.reduce((acc, p) => {
        return { x: acc.x + p.x / points.length, y: acc.y + p.y / points.length };
    }, { x: 0, y: 0 });

    // Смещаем все точки полигона согласно новому положению центра
    const dx = newX - center.x;
    const dy = newY - center.y;

    const newPoints = points.map(p => `${p.x + dx},${p.y + dy}`).join(' ');
    this.draggingPolygon.setAttribute('points', newPoints);
  }

  // Центрирование и масштабирование всех полигонов, чтобы они поместились в область просмотра
  fitPolygonsToView() {
    const polygons = Array.from(this.polygonLayer.querySelectorAll('polygon'));
    if (polygons.length === 0) return; // Нет полигонов

    // Находим ограничивающую рамку всех полигонов
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygons.forEach(poly => {
        const points = poly.getAttribute('points').trim().split(/\s+/).map(p => {
            const [x, y] = p.split(',').map(Number);
            return { x, y };
        });
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
    });

    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const rect = this.svg.getBoundingClientRect();
    const svgWidth = rect.width;
    const svgHeight = rect.height;

    if (bboxWidth === 0 || bboxHeight === 0) return;

    // Вычисляем масштаб для размещения всех полигонов с отступом 20%
    const scaleX = (svgWidth * 0.8) / bboxWidth;
    const scaleY = (svgHeight * 0.8) / bboxHeight;

    this.scale = Math.min(scaleX, scaleY);

    // Сброс смещения, т.к. центрируем через трансформацию
    this.offset = { x: 0, y: 0 };

    // Сохраняем центр полигона для трансформации
    this._center = { x: centerX, y: centerY };

    this._applyTransform();
  }

  // Конец перетаскивания полигона
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

    // Фон осей координат
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

    // Линии осей координат
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

    // Подписи осей X
    for (let x = startX; x <= endX; x += spacing) {
      if (x < 0) continue; // Пропускаем отрицательные значения X
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

    // Подписи осей Y
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

  // Загрузка полигонов из массива строк с точками
  loadPolygons(pointsArray) {
    this.polygonLayer.innerHTML = ''; // Очищаем слой с полигонами
    pointsArray.forEach(points => {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', points);
      poly.setAttribute('fill', 'crimson');
      poly.setAttribute('stroke', '#000');
      poly.setAttribute('stroke-width', '1');
      this.polygonLayer.appendChild(poly);
    });
    this.fitPolygonsToView(); // Автоматически подгоняем масштаб и позицию
  }

  // Получение массива всех полигонов (их точек)
  getPolygons() {
    return Array.from(this.polygonLayer.querySelectorAll('polygon'))
      .map(p => p.getAttribute('points'));
  }

  // Очистка всех полигонов
  clearPolygons() {
    this.polygonLayer.innerHTML = '';
  }
}

// Регистрация кастомного элемента
customElements.define('polygon-editor', PolygonEditor);
