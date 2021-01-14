/* global TrelloPowerUp */

var t = TrelloPowerUp.iframe();

window.config.addEventListener("submit", function(event) {
  event.preventDefault();

  let boardConf = {
    url: window.url.value,
    customer: window.cust.value,
    user: window.user.value,
    password: window.pwd.value,
    apikey: window.apikey.value
  };

  return t.set("board", "shared", boardConf).then(function() {
    t.closePopup();
  });
});

t.render(function() {
  return [
    t.get("board", "shared")
    //  .then(function(data) {
    //    console.log(JSON.stringify(data, null, 2));
    //  })

      .then(function() {
        t.sizeTo("#config").done();
      }),

    t.get("board", "shared", "url").then(function(url) {
      console.log(JSON.stringify(url, null, 2));
      window.url.value = url;
    }),

    t.get("board", "shared", "customer").then(function(customer) {
      console.log(JSON.stringify(customer, null, 2));
      window.cust.value = customer;
    }),

    t.get("board", "shared", "user").then(function(user) {
      console.log(JSON.stringify(user, null, 2));
      window.user.value = user;
    }),

    t.get("board", "shared", "password").then(function(password) {
      //console.log(JSON.stringify(password, null, 2));
      window.pwd.value = password;
    }),
    
    t.get("board", "shared", "apikey").then(function(apikey) {
      //console.log(JSON.stringify(password, null, 2));
      window.apikey.value = apikey;
    })
  ];
});
