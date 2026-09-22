/**
 * USSD screen copy. The service runs in English only; keeping the wording in one
 * place still makes it easy to review, and to translate later if that is wanted.
 */
const strings = {
  en: {
    welcome: 'Welcome to AgriMart',
    welcomeBack: 'Welcome back',
    sell: 'Sell Produce',
    prices: 'Market Prices',
    myListings: 'My Listings',
    buy: 'Buy Produce',
    myOrders: 'My Orders',
    account: 'My Account',
    help: 'Help & Support',
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    chooseOption: 'Choose an option',
    invalidOption: 'Invalid choice. Please try again.',
    enterPin: 'Enter your 4-digit PIN',
    wrongPin: 'Incorrect PIN',
    sessionEnd: 'Thank you for using AgriMart',
    noRecords: 'No records found',
    enterQuantity: 'Enter quantity',
    enterPrice: 'Enter price per unit in GHS',
    registerFirst: 'You are not registered yet',
    enterName: 'Enter your full name',
    chooseRegion: 'Choose your region',
    chooseDistrict: 'Choose your district',
    createPin: 'Create a 4-digit PIN',
    confirmPin: 'Re-enter your PIN to confirm',
    pinMismatch: 'PINs did not match. Please start again.',
    registrationDone: 'Registration successful',
    listingCreated: 'Your produce is now listed',
    orderPlaced: 'Order placed successfully',
  },
};

const t = (key) => strings.en[key] || key;

module.exports = { t, strings };
