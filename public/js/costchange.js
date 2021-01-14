/* global TrelloPowerUp */

var t = TrelloPowerUp.iframe();

window.costchange.addEventListener("submit", function(event) {
  event.preventDefault();

  let cost = window.cost.value;

  return t.set("card", "shared", "cost", cost).then(async function() {
    let c = await t.get("card", "shared", "cost");
    console.log(JSON.stringify(c, null, 2));
    let u = await t.get("board", "shared", "url");
    let a = await t.get("board", "shared", "apikey");
    let i = await t.get("card", "shared", "procId");
    let xid = await t.get("card", "shared", "X1CardId");
    let xurl = new URL(
      u + "/servicetrace/api/processes/" + i + "/processboardtasks/" + xid
    );
    let body = JSON.stringify({
      data: {
        type: "processboardtasks",
        id: `${xid}`,
        attributes: { cost: `${c}` }
      }
    });

    await fetch(`${xurl}`, {
      method: "PATCH",
      headers: {
        "x-apikey": `${a}`,
        "Content-Type": "application/vnd.api+json"
      },
      body: body
    })
      .then(async response => {
        const r = await response;
        if (response.status == 204) {
          console.log(
            JSON.stringify(
              "X1 proc board task cost updated for " + xid,
              null,
              2
            )
          );
          t.closePopup();
        } else {t.closePopup();}
      //  t.closePopup();
      })
      /*.catch(err => {
        console.error(JSON.stringify(err, null, 2));
        //t.closePopup();
      });*/
  });
});

t.render(function() {
  return [
    t.get("card", "shared"),

    t.get("card", "shared", "cost").then(function(cost) {
      console.log(JSON.stringify(cost, null, 2));
      window.cost.value = cost;
    })
  ];
});
