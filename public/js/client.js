/* global TrelloPowerUp */

var Promise = TrelloPowerUp.Promise;

var X1_ICON =
  "https://cdn.glitch.com/8c6fa537-aa90-493c-a84e-acead5898cb2%2FX1%20216x216px%20large.png?v=1606811793870";

var lastSync;

async function x1Auth(url, cust, user, pwd) {
  console.log("auth called...");
  var param = new URLSearchParams();
  var token = "";
  param.append("grant_type", "password");
  param.append("scope", "RPA");

  var x1UrlToken = new URL(url + "/servicetrace/auth/oauth2/token");
  param.append("customer", cust);
  param.append("username", user);
  param.append("password", pwd);

  await fetch(`${x1UrlToken}`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic OWUzMzkxYTMtZGNhNC00OTkyLWEzNTktM2QxMjdiZTM3OWU5OjY0NDM3MmIxLTkzMTYtNDA5Yi05MDk5LWI4MjYxOWQ3NjExNg==",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: param
  }).then(async response => {
    const r = await response.json();
    token = r.access_token;
  });
  // console.log(token);
  return token;
}

async function checkUpdateX1(t, opts) {
  return [
    Promise.all([
      t.board("name"),
      t.board("id"),
      t.get("board", "shared", "url"),
      t.get("board", "shared", "customer"),
      t.get("board", "shared", "user"),
      t.get("board", "shared", "password"),
      t.get("board", "shared", "apikey"),
      t.lists("all"),
      t.cards("all")
    ]).then(
      async ([
        name,
        id,
        url,
        customer,
        user,
        password,
        apikey,
        lists,
        cards
      ]) => {
        if (lastSync != undefined) {
          console.log("X1 checkupdate...");

          var tok = await x1Auth(url, customer, user, password);
          //console.log(tok);

          if (tok != undefined) {
            var x1UrlTasks = new URL(
              url +
                "/servicetrace/services/rpa/myX1/processes/processBoardTasks"
            );

            fetch(`${x1UrlTasks}`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${tok}`
              }
            }).then(async response => {
              const data = await response.json();
              //console.log(JSON.stringify(data, null, 2));

              //this comparison wont work if the order of the keys is different... lodash package can make the deep comparison of JSON objects
              if (JSON.stringify(lastSync) == JSON.stringify(data)) {
                //the proc board tasks data did not changed on X1 side, so check if trello was updated
                //if trello was updated, update the X1 data also, and update lastSync
                console.log(JSON.stringify("X1 data did not changed", null, 2));
                var change = checkX1Data(
                  t,
                  opts,
                  data,
                  lists,
                  cards,
                  url,
                  tok,
                  apikey
                );
                if (change) {
                  fetch(`${x1UrlTasks}`, {
                    method: "GET",
                    headers: {
                      Authorization: `Bearer ${tok}`
                    }
                  }).then(async response => {
                    const data2 = await response.json();
                    lastSync = data2;
                  });
                }
              } else {
                //proc board task data changed, so check were the difference is...
                //if the trello data is the same as the lastSync - so the values from the last synchronization, then the tasks were changed in X1, it means trello must be updated
                //if the trello data differs from lastSync, then both sides - trello and X1 - were changed. leading is X1, so update Trello data - but the trello data gets lost...pop-up?
                //so update trello data and lastSync
                lastSync = data;
                console.log(JSON.stringify("X1 data changed", null, 2));
                console.log(JSON.stringify("lastSync updated", null, 2));
                checkTrelloData(t, opts, lastSync, lists, cards);
              }
            });
          } else {
            console.log("wrong bearer token");
          }
        }
      }
    )
  ];
}

async function checkX1Data(t, opts, data, lists, cards, url, token, apikey) {
  //following fields can be updated: description, dueDate, state(list), color
  console.log("checkX1Data...");
  var changed = false;
  var arrS = data.data;
  var arrT = cards;

  var inprogListId = lists.find(element => element.name == "In Progress").id;
  var todoListId = lists.find(element => element.name == "To-do").id;
  var compListId = lists.find(element => element.name == "Completed").id;

  for (const card of arrT) {
    var X1CardId = await t.get(card.id, "shared", "X1CardId");
    let procId = await t.get(card.id, "shared", "procId");

    var col = await t.get(card.id, "shared", "color");

    if (X1CardId != undefined) {
      console.log(JSON.stringify("X1cardId" + X1CardId, null, 2));
      //console.log(JSON.stringify(card, null, 2));

      var task = arrS.find(element => element.id == X1CardId);
      let xurl = new URL(
        url +
          "/servicetrace/api/processes/" +
          procId +
          "/processboardtasks/" +
          X1CardId
      );

      if (card.due != task.attributes.dueDate) {
        let body = JSON.stringify({
          data: {
            type: "processboardtasks",
            id: `${X1CardId}`,
            attributes: { dueDate: `${card.due}` }
          }
        });

        await fetch(`${xurl}`, {
          method: "PATCH",
          headers: {
            "x-apikey": `${apikey}`,
            "Content-Type": "application/vnd.api+json"
          },
          body: body
        }).then(async response => {
          if (response.statur == 204) {
            changed = true;
          }
        });
      }

      if (card.desc != task.attributes.description) {
        let body = JSON.stringify({
          data: {
            type: "processboardtasks",
            id: `${X1CardId}`,
            attributes: { description: `${card.desc}` }
          }
        });

        await fetch(`${xurl}`, {
          method: "PATCH",
          headers: {
            "x-apikey": `${apikey}`,
            "Content-Type": "application/vnd.api+json"
          },
          body: body
        }).then(async response => {
          if (response.statur == 204) {
            changed = true;
          }
        });
      }

      var s;
      if (card.idList == todoListId) {
        s = 1;
      } else if (card.idList == inprogListId) {
        s = 2;
      } else if (card.idList == compListId) {
        s = 3;
      }

      var c;
      if (col == "green") {
        c = 1;
      } else if (col == "yellow") {
        c = 2;
      } else if (col == "red") {
        c = 3;
      }
      //console.log(JSON.stringify("color" + c, null, 2));

      if (task.attributes.color != c) {
        let body = JSON.stringify({
          data: {
            type: "processboardtasks",
            id: `${X1CardId}`,
            attributes: { color: `${c}` }
          }
        });

        await fetch(`${xurl}`, {
          method: "PATCH",
          headers: {
            "x-apikey": `${apikey}`,
            "Content-Type": "application/vnd.api+json"
          },
          body: body
        }).then(async response => {
          if (response.statur == 204) {
            changed = true;
          }
        });
      }

      if (task.attributes.state != s) {
        let body = JSON.stringify({
          data: {
            type: "processboardtasks",
            id: `${X1CardId}`,
            attributes: { state: `${s}` }
          }
        });

        await fetch(`${xurl}`, {
          method: "PATCH",
          headers: {
            "x-apikey": `${apikey}`,
            "Content-Type": "application/vnd.api+json"
          },
          body: body
        }).then(async response => {
          if (response.statur == 204) {
            changed = true;
          }
        });
      }
    }
  }
  return changed;
}

async function checkTrelloData(t, opts, lastSync, lists, cards) {
  //check the difference between lastSync and Trello cards and update Trello card if there is a difference
  //first of all check the number of the cards and tasks...
  //take care about the number of the cards and tasks - cards without tasks will be deleted, or new cards will be added

  console.log("checkTrelloData...");

  var arrS = lastSync.data;
  var arrT = cards;

  var inprogListId = lists.find(element => element.name == "In Progress").id;
  var todoListId = lists.find(element => element.name == "To-do").id;
  var compListId = lists.find(element => element.name == "Completed").id;

  for (const card of arrT) {
    var X1CardId = await t.get(card.id, "shared", "X1CardId");
    var col = await t.get(card.id, "shared", "color");

    if (X1CardId != undefined) {
      //x1 card found
      var task = arrS.find(element => element.id == X1CardId);

      if (task != undefined) {
        var c;
        if (task.attributes.color == 1) {
          c = "green";
        } else if (task.attributes.color == 2) {
          c = "yellow";
        } else if (task.attributes.color == 3) {
          c = "red";
        }

        var lid;
        if (task.attributes.state == 1) {
          //state 1 = To-do
          lid = todoListId;
        } else if (task.attributes.state == 2) {
          //state = 2 = In Progress
          lid = inprogListId;
        } else if (task.attributes.state == 3) {
          //state = 3 = Completed
          lid = compListId;
        }

        if (card.listId != lid) {
          //update listId
          await window.Trello.put(`/cards/${card.id}`, {
            idList: lid
          });
        }
        if (card.due != task.attributes.dueDate) {
          //update dueDate
          await window.Trello.put(`/cards/${card.id}`, {
            due: task.attributes.dueDate
          });
        }
        if (card.desc != task.attributes.desc) {
          //update desc
          await window.Trello.put(`/cards/${card.id}`, {
            desc: task.attributes.desc
          });
        }

        if (col != c) {
          //update color - cover
          await window.Trello.put(`/cards/${card.id}`, {
            cover: {
              color: c
            }
          });
          await t.set(card.id, "shared", "color", c);
        }
        //lets check the X1 fields of the card

        let co = await t.get(card.id, "shared", "cost");

        if (co != task.attributes.cost) {
          //update cost
          await t.set(card.id, "shared", "cost", task.attributes.cost);
          // console.log("checkTrelloData cost update..." + task.attributes.cost);
        }
      } else {
        //no task for the card found - should not be the case
      }
    }
  }
}

//Trello Rest client auth
var authenticationSuccess = function() {
  console.log("Successful authentication");
};

var authenticationFailure = function() {
  console.log("Failed authentication");
};

window.Trello.authorize({
  type: "popup",
  name: "X1 integration",
  scope: {
    read: "true",
    write: "true"
  },
  expiration: "never",
  success: authenticationSuccess,
  error: authenticationFailure
});

//for card creation
async function creationCardSuccess(data) {
  console.log("card created successfully: " + data.id);
  //console.log(JSON.stringify(data, null, 2));
}

async function creationCardError(data) {
  console.log("card creation failed " + data);
}

//for list creation
async function creationListSuccess(data) {
  console.log("list created successfully: " + data);
  //console.log(JSON.stringify(data, null, 2));
}

async function creationListError(data) {
  console.log("list creattion failed " + data);
}

//checking lists
async function checkLists(lists, id) {
  //console.log(lists);
  //create the lists if they do not exist
  if (lists.find(element => element.name == "To-do") == undefined) {
    console.log(JSON.stringify("creating list To-do...", null, 2));
    var newList = {
      name: "To-do",
      idBoard: id.id,
      pos: "top"
    };
    await window.Trello.post(
      "/lists/",
      newList,
      creationListSuccess,
      creationListError
    );
  }

  if (lists.find(element => element.name == "In Progress") == undefined) {
    console.log(JSON.stringify("creating list In Progress...", null, 2));
    var newList = {
      name: "In Progress",
      idBoard: id.id,
      pos: "top"
    };
    await window.Trello.post(
      "/lists/",
      newList,
      creationListSuccess,
      creationListError
    );
  }

  if (lists.find(element => element.name == "Completed") == undefined) {
    console.log(JSON.stringify("creating list Completed...", null, 2));
    //console.log(id);
    var newList = {
      name: "Completed",
      idBoard: id.id,
      pos: "top"
    };
    await window.Trello.post(
      "/lists/",
      newList,
      creationListSuccess,
      creationListError
    );
  }
}

//card creation with X1 fields
async function createX1Card(
  t,
  opts,
  cardName,
  listId,
  dueDate,
  desc,
  cover,
  X1CardId,
  procName,
  c,
  procId
) {
  var newCard = {
    name: cardName,
    idList: listId,
    pos: "top",
    due: dueDate,
    desc: desc
  };

  var cardId;
  await window.Trello.post("/cards/", newCard, function cardCreate(data) {
    cardId = data.id;
    console.log("card created successfully: " + cardId);
    //console.log(data);
  });

  await window.Trello.put(`/cards/${cardId}`, {
    cover: {
      color: cover
    }
  });

  await t.set(cardId, "shared", "color", cover);
  await t.set(cardId, "shared", "X1CardId", X1CardId);
  await t.set(cardId, "shared", "procName", procName);
  await t.set(cardId, "shared", "cost", c);
  await t.set(cardId, "shared", "procId", procId);
  console.log(
    JSON.stringify("stored " + cardId + " x1 id: " + X1CardId, null, 2)
  );
}

//update card with X1 data
async function updateX1data(
  t,
  opts,
  cards,
  cardName,
  listId,
  dueDate,
  desc,
  color,
  X1CardId,
  procName,
  cost
) {
  let card = cards.find(element => element.name == cardName);
  let cardId = card.id;
  console.log("card id update: " + cardId);
  let xi = await t.get(cardId, "shared", "X1CardId");
  let col = await t.get(cardId, "shared", "color");

  if (card.listId != listId) {
    //update listId
    await window.Trello.put(`/cards/${cardId}`, {
      idList: listId
    });
  }
  if (card.due != dueDate) {
    //update dueDate
    await window.Trello.put(`/cards/${cardId}`, {
      due: dueDate
    });
  }
  if (card.desc != desc) {
    //update desc
    await window.Trello.put(`/cards/${cardId}`, {
      desc: desc
    });
  }

  if (col != color) {
    //update color - cover
    await window.Trello.put(`/cards/${cardId}`, {
      cover: {
        color: color
      }
    });
    t.set(cardId, "shared", "color", color);
  }
  //lets check the X1 fields of the card

  //let pn = await    t.get(card.id, "shared", "procName");
  let c = await t.get(cardId, "shared", "cost");

  if (c != cost) {
    //update cost
    await t.set(cardId, "shared", "cost", cost);
  }
}

var onSynchBtnClick = function(t, opts) {
  return [
    Promise.all([
      t.board("name"),
      t.board("id"),
      t.get("board", "shared", "url"),
      t.get("board", "shared", "customer"),
      t.get("board", "shared", "user"),
      t.get("board", "shared", "password"),
      t.lists("all"),
      t.cards("all")
    ]).then(([name, id, url, customer, user, password, lists, cards]) => {
      var param = new URLSearchParams();
      param.append("grant_type", "password");
      param.append("scope", "RPA");

      console.log(JSON.stringify(url, null, 2));
      var x1UrlToken = new URL(url + "/servicetrace/auth/oauth2/token");
      var x1UrlTasks = new URL(
        url + "/servicetrace/services/rpa/myX1/processes/processBoardTasks"
      );
      var x1Cust = customer;
      param.append("customer", customer);
      var x1User = user;
      param.append("username", user);
      var x1Pwd = password;
      param.append("password", password);

      fetch(`${x1UrlToken}`, {
        method: "POST",
        headers: {
          Authorization:
            "Basic OWUzMzkxYTMtZGNhNC00OTkyLWEzNTktM2QxMjdiZTM3OWU5OjY0NDM3MmIxLTkzMTYtNDA5Yi05MDk5LWI4MjYxOWQ3NjExNg==",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: param
      })
        .then(async response => {
          const r = await response.json();

          if (response.status == 200) {
            var token = r.access_token;
            //console.log(JSON.stringify(token, null, 2));

            fetch(`${x1UrlTasks}`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`
              }
            })
              .then(async response => {
                const data = await response.json();
                lastSync = data;
                console.log(JSON.stringify("lastSync updated", null, 2));
                //we got all tasks from myX1 in data

                //create the list To-do, In Progress and Completed if they do not exists
                try {
                  await checkLists(lists, id);

                  var l = await window.Trello.get(`/boards/${id.id}/lists`, {});

                  var inprogListId = l.find(
                    element => element.name == "In Progress"
                  ).id;
                  var todoListId = l.find(element => element.name == "To-do")
                    .id;
                  var compListId = l.find(
                    element => element.name == "Completed"
                  ).id;
                } catch (err) {
                  console.error(
                    JSON.stringify("error in list creation" + err, null, 2)
                  );
                }

                console.log(JSON.stringify("lists done", null, 2));
                //check the cards
                for (const task of data.data) {
                  //console.log(JSON.stringify(task, null, 2));

                  var X1CardId = task.id;
                  console.log(JSON.stringify(X1CardId, null, 2));

                  var cardName = task.attributes.name;

                  console.log(JSON.stringify(cardName, null, 2));

                  var dueDate = task.attributes.dueDate;
                  var color = task.attributes.color;
                  var state = task.attributes.state;
                  var desc = task.attributes.description;
                  var cost = task.attributes.cost;
                  var procName = task.attributes.processName;
                  var procId = task.attributes.processId;

                  var cardlist = await t.cards("all");

                  var c;
                  if (color == 1) {
                    c = "green";
                  } else if (color == 2) {
                    c = "yellow";
                  } else if (color == 3) {
                    c = "red";
                  }

                  var lid;
                  if (state == 1) {
                    //state 1 = To-do
                    lid = todoListId;
                  } else if (state == 2) {
                    //state = 2 = In Progress
                    lid = inprogListId;
                  } else if (state == 3) {
                    //state = 3 = Completed
                    lid = compListId;
                  }

                  if (
                    cardlist.find(element => element.name == cardName) ==
                    undefined
                  ) {
                    //card does not exists on the board - create card -here only name check
                    await createX1Card(
                      t,
                      opts,
                      cardName,
                      lid,
                      dueDate,
                      desc,
                      c,
                      X1CardId,
                      procName,
                      cost,
                      procId
                    ).catch(e => {
                      console.error(e);
                    });
                  } else {
                    //card with the name exists on the board - check if it should be updated
                    //check if there are more then one cards with the same name, but different x1 id

                    var cardsName = cardlist.filter(
                      element => element.name == cardName
                    );

                    let created = false;
                    for (let card of cardsName) {
                      //
                      let xid = await t.get(card.id, "shared", "X1CardId");

                      if (xid == X1CardId) {
                        console.log(
                          JSON.stringify(
                            "card with x1 id already exists, check for updates... ",
                            null,
                            2
                          )
                        );

                        await updateX1data(
                          t,
                          opts,
                          cards,
                          cardName,
                          lid,
                          dueDate,
                          desc,
                          c,
                          X1CardId,
                          procName,
                          cost
                        ).catch(e => {
                          console.error(e);
                        });
                        created = true;
                      }
                    }

                    if (created == false) {
                      //card with same name but a new x1 id, so create the new card
                      console.log(
                        JSON.stringify(
                          "card with name already exists, but x1 id is new... ",
                          null,
                          2
                        )
                      );
                      await createX1Card(
                        t,
                        opts,
                        cardName,
                        lid,
                        dueDate,
                        desc,
                        c,
                        X1CardId,
                        procName,
                        cost,
                        procId
                      ).catch(e => {
                        console.error(e);
                      });
                    }
                  }
                } //end of outer for
              }) //end of fetch x1 tasks

              .catch(err => {
                console.error(JSON.stringify(err, null, 2));
              });
          } else {
            //X1 auth failed - no token
            console.log(JSON.stringify("Error in auth", null, 2));
          }
        }) //end of fetch autch
        .catch(err => {
          console.error(JSON.stringify(err, null, 2));
        });
    })
  ];
};

const getX1CardId = async t => {
  const idCard = t.getContext().card;

  let xid = await t.get(idCard, "shared", "X1CardId");
  console.log(JSON.stringify(xid, null, 2));
  return xid;
};

const getX1procName = async t => {
  const idCard = t.getContext().card;

  let procn = await t.get(idCard, "shared", "procName");
  console.log(JSON.stringify(procn, null, 2));
  return procn;
};

const getX1Cost = async t => {
  const idCard = await t.getContext().card;

  let co = await t.get(idCard, "shared", "cost");
  console.log(JSON.stringify(co, null, 2));
  return co;
};

const getX1badges = async (t, opts) =>
  Promise.all([
    t.get("board", "shared", "url"),
    getX1CardId(t),
    getX1procName(t),
    getX1Cost(t)
  ]).then(([url, x, p, c]) => {
    const x1IdBadge = {
      title: "X1 Process Task Id",
      text: `${x}`,
      color: null
    };

    const procNameBadge = {
      title: "X1 Process Name",
      text: `${p}`,
      color: null
    };

    const costBadge = {
      title: "X1 Task Cost",
      text: `${c}`,
      //color: null,
      callback: function(t, opts) {
        return t.popup({
          title: "Change X1 process board task cost ",
          url: "costchange.html"
        });
      }
    };

    const urlBadge = {
      title: "Go to X1",
      text: "X1 URL",
      url: `${url}`
    };

    let badges = [];
    badges.push(x1IdBadge);
    badges.push(procNameBadge);
    badges.push(costBadge);
    badges.push(urlBadge);

    return badges;
  });

TrelloPowerUp.initialize({
  "board-buttons": function(t, opts) {
    setInterval(function() {
      checkUpdateX1(t, opts);
      console.log("timer");
    }, 90000); //1,5 min})
    return [
      {
        text: "Synch with my X1!",
        icon: X1_ICON,
        callback: onSynchBtnClick,
        condition: "edit"
      },
      {
        text: "X1 configuration",
        icon: X1_ICON,
        callback: function(t) {
          return t.popup({
            title: "X1 connection configuration",
            url: "configuration.html"
          });
        },
        condition: "edit"
      }
    ];
  },

  "card-detail-badges": getX1badges
});
