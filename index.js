var express=require('express');
var ejs=require('ejs');
var bodyParser=require('body-parser');
var mysql=require('mysql');
var session=require('express-session');
const { query } = require('express');

var connec=mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "e-commerce"
});

var app=express();
app.use(express.static('public'));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
    secret: "secret",
    resave: true,
    saveUninitialized: true
}));


function isProductInCart(cart,id){
    for(let i=0;i<cart.length;i++)
    {
        if(cart[i].id==id)return true;
    }
    return false;
}

function calculateTotal(cart,req){
    var total=0;
    for(let i=0;i<cart.length;i++)
    {
        if(cart[i].sale_price)total+=(cart[i].sale_price)*(cart[i].quantity);
        else total+=(cart[i].price*cart[i].quantity);
    }
    total=total.toFixed(2);
    req.session.total=total;
    return total;
}


// Navbar starts
app.get('/',(req,res)=>{
    connec.query("SELECT * FROM products",(err,result)=>{
        res.render('pages/index',{page_name: "",result: result});
    })
});

app.get('/about',(req,res)=>{
    res.render('pages/about',{page_name: "about"});
});

app.get('/products',(req,res)=>{
    connec.query("SELECT * FROM products",(err,result)=>{
        res.render('pages/products',{page_name: "products",result: result});
    })
});
// Navbar ends

app.get('/single_product',(req,res)=>{
    var id=req.query.id;
    connec.query("SELECT * FROM products WHERE id="+id,(err,result)=>{
        res.render('pages/single_product',{page_name: "single_product",result: result});
    })
    
});

app.post('/add_to_cart',(req,res)=>{
    var id=req.body.id;
    var name=req.body.name;
    var price=req.body.price;
    var sale_price=req.body.sale_price;
    var quantity=req.body.quantity;
    var image=req.body.image;
    var product={
        id: id,
        name: name,
        price: price,
        sale_price: sale_price,
        quantity: quantity,
        image: image,
    }

    if(req.session.cart)
    {
        var cart=req.session.cart;
        if(!isProductInCart(cart,id))
        {
            cart.push(product);
        }
    }
    else
    {
        req.session.cart=[product];
    }
    var cart=req.session.cart;
    calculateTotal(cart,req);
    res.redirect('/cart');
});

app.get('/cart',(req,res)=>{
    var cart=req.session.cart;
    var total=req.session.total;
    res.render('pages/cart',{page_name: "cart",cart: cart,total: total});
});

app.post('/remove_product',(req,res)=>{
    var id=req.body.id;
    var cart=req.session.cart;
    cart=cart.filter(item=>{
        return item.id!==id;
    })
    req.session.cart=cart;
    calculateTotal(cart,req);
    res.redirect('/cart');
});

app.post('/edit_product_quantity',(req,res)=>{
    var id=req.body.id;
    var increase_btn=req.body.increase_product_quantity_btn;
    var cart=req.session.cart;
    for(let i=0;i<cart.length;i++)
    {
        if(cart[i].id===id)
        {
            if(increase_btn)cart[i].quantity++;
            else if(cart[i].quantity>0)cart[i].quantity--;
        }
    }
    req.session.cart=cart;
    calculateTotal(cart,req);
    res.redirect('/cart');
});

app.get('/checkout',(req,res)=>{
    var total=req.session.total;
    res.render('pages/checkout',{page_name: "checkout",total: total});
});

//checkout starts
app.post('/place_order',(req,res)=>{
    var name=req.body.name;
    var email=req.body.email;
    var phone=req.body.phone;
    var city=req.body.city;
    var address=req.body.address;
    var cost=req.session.total;
    var status="not paid";
    var date=new Date();
    var products_ids="";
    var order_id=Date.now();
    req.session.order_id=order_id;
    var connec=mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "e-commerce"
    });
    var cart=req.session.cart;
    for(let i=0;i<cart.length;i++){
        products_ids+=','+cart[i].id;
    }
    if(products_ids[0]==',')products_ids=products_ids.substring(1);
    connec.connect((err)=>{
        if(err){
            console.log(err);
        }
        else{
            var query="INSERT INTO orders(id,cost,name,email,status,city,address,phone,date,products_ids) VALUES ?";
            var values=[[order_id,cost,name,email,status,city,address,phone,date,products_ids]];
            connec.query(query,[values],(err,result)=>{
                for(let i=0;i<cart.length;i++){
                    var query="INSERT INTO order_items(order_id,product_id,product_name,product_price,product_image,product_quantity,order_date) VALUES ?";
                    var values=[[order_id,cart[i].id,cart[i].name,cart[i].price,cart[i].image,cart[i].quantity,new Date()]];
                    connec.query(query,[values],(err,result)=>{});
                }
                res.redirect('/payment');
            })
        }
    })
});

app.get('/payment',(req,res)=>{
    var total=req.session.total;
    res.render('pages/payment',{page_name: "payment",total: total});
});

app.get('/verify_payment',(req,res)=>{
    var transaction_id=req.query.transaction_id;
    var order_id=req.session.order_id;
    var connec=mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "e-commerce"
    });
    connec.connect((err)=>{
        if(err){
            console.log(err);
        }
        else{
            var query="INSERT INTO payments(order_id,transaction_id,date) VALUES ?";
            var values=[[order_id,transaction_id,new Date()]];
            connec.query(query,[values],(err,result)=>{
                connec.query("UPDATE orders SET status='paid' WHERE id="+order_id,(err,result)=>{});
                res.redirect('/thank_you');
            })
        }
    })
});

app.get('/thank_you',(req,res)=>{
    var order_id=req.session.order_id;
    res.render('pages/thank_you',{order_id: order_id,page_name: ''});
});

//localhost:5000
app.listen("5000",()=>{
    console.log("server is running at port 5000");
});