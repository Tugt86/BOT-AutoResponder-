const SHOP_ITEMS = [
    { id: 1, name: 'Item A', price: 10 },
    { id: 2, name: 'Item B', price: 20 },
    { id: 3, name: 'Item C', price: 30 },
];

function displayShop() {
    SHOP_ITEMS.forEach(item => {
        console.log(`ID: ${item.id}, Name: ${item.name}, Price: $${item.price}`);
    });
}

function handleBuyItem(itemId) {
    const item = SHOP_ITEMS.find(item => item.id === itemId);
    if (!item) {
        console.log('Item not found!');
        return;
    }
    console.log(`You bought ${item.name} for $${item.price}!`);
}

function addItem(item) {
    SHOP_ITEMS.push(item);
}

function removeItem(itemId) {
    const index = SHOP_ITEMS.findIndex(item => item.id === itemId);
    if (index > -1) {
        SHOP_ITEMS.splice(index, 1);
    }
}