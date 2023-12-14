const {
    PORT,
    app,
    mongoose,
    DATA
} = require('./App');

// Database connection.... 
const dataConnect = async () => {
    try {
        await mongoose.connect("mongodb+srv://mszaman:mszaman@cluster0.k61kwgo.mongodb.net/social_book");
        console.log('Database Connection Successful')
    } catch (err) {
        console.log(err.message);
    }
};

// running server.....
app.listen(8500, async () => {
    try {
        console.log(`Sever run successfully on http://localhost: 8500`);
        await dataConnect();
    } catch (error) {
        console.log(error.message);
    }
});