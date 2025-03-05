// https://opensource.adobe.com/Spry/samples/data_region/JSONDataSetSample.html

export default [
	[100, 500, 300, 200, 400],
	[
		{ color: "red", value: "#f00" },
		{ color: "green", value: "#0f0" },
		{ color: "blue", value: "#00f" },
		{ color: "cyan", value: "#0ff" },
		{ color: "magenta", value: "#f0f" },
		{ color: "yellow", value: "#ff0" },
		{ color: "black", value: "#000" },
	],
	{ color: "red", value: "#f00" },
	[
		{
			id: "0001",
			type: "donut",
			name: "Cake",
			ppu: 0.55,
			batters: {
				batter: [
					{ id: "1001", type: "Regular" },
					{ id: "1002", type: "Chocolate" },
					{ id: "1003", type: "Blueberry" },
					{ id: "1004", type: "Devil's Food" },
				],
			},
			topping: [
				{ id: "5001", type: "None" },
				{ id: "5002", type: "Glazed" },
				{ id: "5005", type: "Sugar" },
				{ id: "5007", type: "Powdered Sugar" },
				{ id: "5006", type: "Chocolate with Sprinkles" },
				{ id: "5003", type: "Chocolate" },
				{ id: "5004", type: "Maple" },
			],
		},
		{
			id: "0003",
			type: "donut",
			name: "Old Fashioned",
			ppu: 0.55,
			batters: {
				batter: [
					{ id: "1001", type: "Regular" },
					{ id: "1002", type: "Chocolate" },
				],
			},
			topping: [
				{ id: "5001", type: "None" },
				{ id: "5002", type: "Glazed" },
				{ id: "5003", type: "Chocolate" },
				{ id: "5004", type: "Maple" },
			],
		},
	],
	{
		id: "0001",
		type: "donut",
		name: "Cake",
		image: {
			url: "images/0001.jpg",
			width: 200,
			height: 200,
		},
		thumbnail: {
			url: "images/thumbnails/0001.jpg",
			width: 32,
			height: 32,
		},
	},
	{
		items: {
			item: [
				{
					id: "0001",
					type: "donut",
					name: "Cake",
					ppu: 0.55,
					batters: {
						batter: [
							{ id: "1001", type: "Regular" },
							{ id: "1002", type: "Chocolate" },
							{ id: "1003", type: "Blueberry" },
							{ id: "1004", type: "Devil's Food" },
						],
					},
					topping: [
						{ id: "5001", type: "None" },
						{ id: "5002", type: "Glazed" },
						{ id: "5005", type: "Sugar" },
						{ id: "5007", type: "Powdered Sugar" },
						{ id: "5006", type: "Chocolate with Sprinkles" },
						{ id: "5003", type: "Chocolate" },
						{ id: "5004", type: "Maple" },
					],
				},
			],
		},
	},
]
