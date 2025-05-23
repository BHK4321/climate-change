export default async function handler(req, res) {
    const { prompt, type } = req.query;
    try {
        if (type === 1) {
            const response = await fetch("https://climate-change-nlbh.onrender.com/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.FASTAPI_API_KEY,
                },
                body: JSON.stringify({ user_query: "What is climate change?" }),
            });
            const data = await response.text();
            console.log(data);
            return res.status(200).json(data);
        } else {
            const response = await fetch("https://climate-change-nlbh.onrender.com/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.FASTAPI_API_KEY,
                },
                body: JSON.stringify({ user_query: "What is climate change?" }),
            });
            const data = await response.text();
            console.log(data);
            return res.status(200).json(data);
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err });
    }
}
