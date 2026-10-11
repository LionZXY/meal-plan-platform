export function fixturePlan(personId = 'nikita') {
  return {
    schemaVersion: 1, id: `${personId}-test`, personId,
    title: `Тестовый рацион: ${personId}`, description: 'Только тестовые данные',
    products: {
      chicken: {name: 'Курица', originalName: 'Test Chicken Breast', unit: 'g', nutritionPer100: {kcal: 100, protein: 20, fat: 2, carbs: 0}},
      rice: {name: 'Рис', originalName: 'Test Rice', unit: 'g', nutritionPer100: {kcal: 150, protein: 3, fat: 1, carbs: 30}}
    },
    days: ['2026-10-10', '2026-10-11', '2026-10-12'].map((date, index) => ({
      date, meals: [{id: 'lunch', type: 'Обед', title: personId === 'nikita' ? 'Курица с рисом' : 'Рис с курицей',
        ingredients: [{productId: 'chicken', amount: personId === 'nikita' ? 200 : 100}, {productId: 'rice', amount: 100 + index * 10}],
        instructions: 'Приготовить и подать.'}]
    }))
  };
}
export function fixtureCatalog() {
  return {schemaVersion: 1, locale: 'ru-RU', timeZone: 'Europe/London', people: ['nikita', 'nastya'].map(id => ({
    id, name: id === 'nikita' ? 'Никита' : 'Настя', plans: [{id: `${id}-test`, title: 'Тестовая неделя', startDate: '2026-10-10', endDate: '2026-10-12', file: `plans/${id}/plan.json`}]
  }))};
}
