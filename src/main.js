import { getRandomPolygonPoints, createPolygonSVG } from './components/Polygon-utils.js'; // Импортируем функции для создания случайных точек полигона и SVG полигона
import './components/Polygon-editor.js'; // Импортируем определение веб-компонента polygon-editor

const createBtn = document.getElementById('createBtn'); // Кнопка "Создать"
const saveBtn = document.getElementById('saveBtn');     // Кнопка "Сохранить"
const resetBtn = document.getElementById('resetBtn');   // Кнопка "Сбросить"
const bufferZone = document.getElementById('bufferZone'); // Контейнер для хранения созданных полигонов (буферная зона)
const workZone = document.getElementById('workZone');     // Основная рабочая зона — polygon-editor

// Обработчик нажатия на кнопку "Создать"
createBtn.onclick = () => {
  bufferZone.innerHTML = ''; // Очищаем буферную зону перед созданием новых полигонов
  const count = Math.floor(Math.random() * 16) + 5; // Случайное количество полигонов от 5 до 20

  for (let i = 0; i < count; i++) {
    const points = getRandomPolygonPoints(); // Получаем случайные точки для полигона
    const svg = createPolygonSVG(points);    // Создаём SVG элемент полигона с этими точками

    // Оборачиваем SVG в div, чтобы сделать его draggable
    const wrapper = document.createElement('div');
    wrapper.className = 'drag-wrapper';      // Добавляем класс для стилизации
    wrapper.setAttribute('draggable', 'true'); // Делаем div перетаскиваемым
    wrapper.style.width = '120px';            // Задаём ширину
    wrapper.style.height = '120px';           // Задаём высоту
    wrapper.style.cursor = 'grab';            // Курсор при наведении - рука для перетаскивания

    wrapper.appendChild(svg); // Вставляем SVG внутрь обёртки

    // При начале перетаскивания div передаём данные полигона
    wrapper.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', svg.dataset.points); // Передаём точки полигона как текст
    });

    bufferZone.appendChild(wrapper); // Добавляем обёртку с полигоном в буферную зону
  }
};

// Обработчик кнопки "Сохранить"
saveBtn.onclick = () => {
  const polygons = workZone.getPolygons();                  // Получаем текущие полигоны из рабочей зоны
  localStorage.setItem('polygons', JSON.stringify(polygons)); // Сохраняем их в localStorage в формате JSON
  alert('Сохранено!');                                           // Выводим сообщение пользователю
};

// Обработчик кнопки "Сбросить"
resetBtn.onclick = () => {
  localStorage.removeItem('polygons'); // Удаляем сохранённые полигоны из localStorage
  workZone.clearPolygons();             // Очищаем полигоны из рабочей зоны
  alert('Очищено!');                     // Выводим сообщение пользователю
};

// При загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
  // Загружаем сохранённые полигоны из localStorage или пустой массив, если данных нет
  const saved = JSON.parse(localStorage.getItem('polygons') || '[]');
  if (saved.length > 0) {
    workZone.loadPolygons(saved); // Если есть сохранённые полигоны — загружаем их в рабочую зону
  }
});
