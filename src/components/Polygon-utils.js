export function getRandomPolygonPoints() {
  // Случайное число вершин от 3 до 7
  const n = Math.floor(Math.random() * 5) + 3;
  const points = [];

  // Шаг 1: Генерируем n случайных точек в диапазоне 0-100 по X и Y
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    points.push({ x, y });
  }

  // Шаг 2: Вычисляем центр тяжести (центроид) множества точек
  const centroid = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / n, y: acc.y + p.y / n }),
    { x: 0, y: 0 }
  );

  // Шаг 3: Сортируем точки по углу относительно центра, чтобы сформировать выпуклый полигон без пересечений линий
  points.sort((a, b) => {
    const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
    const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
    return angleA - angleB;
  });

  // Шаг 4: Преобразуем массив точек в строку формата "x1,y1 x2,y2 ..."
  const pointStr = points.map(p => `${p.x},${p.y}`).join(' ');
  return pointStr;
}

export function createPolygonSVG(points) {
  // Создаём SVG элемент с размером 120x120 пикселей
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', 120);
  svg.setAttribute('height', 120);
  svg.setAttribute('viewBox', '0 0 120 120');

  // Создаём элемент polygon с заданными точками
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', points);
  polygon.setAttribute('fill', 'crimson');    // Цвет заливки
  polygon.setAttribute('stroke', '#333');     // Цвет границы
  polygon.setAttribute('stroke-width', '1');  // Толщина линии

  // Вставляем полигон внутрь SVG
  svg.appendChild(polygon);

  // Добавляем класс для стилизации и делаем SVG draggable
  svg.classList.add('draggable');
  svg.setAttribute('draggable', 'true');

  // Сохраняем точки в data-атрибут для удобства
  svg.dataset.points = points;

  // Обработчик начала перетаскивания (dragstart)
  svg.addEventListener('dragstart', (e) => {
    // Передаём в данные drag-and-drop строку с точками полигона
    e.dataTransfer.setData('text/plain', svg.dataset.points);
    // Устанавливаем "превью" перетаскиваемого объекта — центрируем изображение полигона
    e.dataTransfer.setDragImage(svg, 60, 60);
  });

  return svg; // Возвращаем готовый SVG элемент с полигоном
}
