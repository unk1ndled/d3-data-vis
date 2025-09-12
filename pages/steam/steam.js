import * as d3 from "d3";

d3.csv("/datasets/steam-data/steam.csv").then((data) => {
  // Convert numeric columns
  data.forEach((d) => {
    d.price = +d.price;
    d.average_playtime = +d.average_playtime;
    d.positive_ratings = +d.positive_ratings;
    d.negative_ratings = +d.negative_ratings;
  });

  console.log("CSV loaded:", data);
});
