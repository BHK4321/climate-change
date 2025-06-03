import os
import sys
from dotenv import load_dotenv
import json
load_dotenv()

project_id = os.getenv("IBM_PROJECT_ID")
api_key = os.getenv("WATSONX_API_KEY")
tavily_api_key = os.getenv("TAVILY_API_KEY")

credentials = {
    "url": "https://us-south.ml.cloud.ibm.com",
    "apikey": api_key
    }

from langchain_community.vectorstores import FAISS
from langchain_ibm import WatsonxEmbeddings, WatsonxLLM
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenTextParamsMetaNames
import os
import pickle

embeddings = WatsonxEmbeddings(
    model_id='ibm/slate-125m-english-rtrvr',
    apikey=credentials.get('apikey'),
    url=credentials.get('url'),
    project_id=project_id
)

faiss_index_path = "faiss_index"

if os.path.exists(faiss_index_path):
    vectorstore = FAISS.load_local(faiss_index_path, embeddings, allow_dangerous_deserialization=True)
else:
    vectorstore = FAISS.from_texts(["dummy"], embeddings)
    vectorstore.save_local(faiss_index_path)

from langchain.schema import Document
retriever = vectorstore.as_retriever()

from langchain_community.tools.tavily_search import TavilySearchResults
web_search_tool = TavilySearchResults(tavily_api_key=tavily_api_key)

llm = WatsonxLLM(
    model_id = "meta-llama/llama-3-405b-instruct",
    url=credentials.get("url"),
    apikey=credentials.get("apikey"),
    project_id=project_id,
    params = {  GenTextParamsMetaNames.DECODING_METHOD: "greedy",
                GenTextParamsMetaNames.MAX_NEW_TOKENS: 1000,
                GenTextParamsMetaNames.TEMPERATURE: 0.7,
                GenTextParamsMetaNames.MIN_NEW_TOKENS: 10})

from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.output_parsers import JsonOutputParser

prompt = PromptTemplate(
    template="""<|begin_of_text|><|start_header_id|>system<|end_header_id|>You are an assistant for environmental product questions, providing comprehensive answers about the environmental impacts of products, including their carbon footprint, water usage, waste generation, and other relevant factors. You should also suggest actionable steps to reduce environmental impact and provide citations for your information.
    {{Below is some context from different sources followed by a user's question. Please answer the question based on the context.

    Documents: {documents}}} <|eot_id|><|start_header_id|>user<|end_header_id|>

    {{ Question: {question} }}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

    Answer:
    """,
    input_variables=["question", "documents"],
)

final_prompt = PromptTemplate(
    template="""
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
YOU ARE A CLIMATE GUIDE FOR THE PEOPLE AND YOUR NAME IS "ECOLENS". DONT MENTION THIS IN YOUR RESPONSES THOUGH BUT IF SOME DISTRACTING QUERY IS ASKED THEN PUT THIS UP.
According to the type value given to you perform the tasks according to question and context provided:
type: {type}

For type == 1:

You are an assistant for environmental product questions, providing comprehensive answers about the environmental impacts of products, including their carbon footprint, water usage, waste generation, and other relevant factors. You should also suggest actionable steps to reduce environmental impact and provide citations for your information.
Given the following context and user question, answer in context of these parameters:

  "rating": Number (0-100, representing your rating as an environmental expert, of the impacts of using that product),
  "text": String (comprehensive answer addressing environmental impacts including carbon footprint, water usage, waste generation, etc.),
  "citations": [{{"label": String, "url": String}}] (list of source URLs that support your answer, minimum 1 source),
  "recommendations": [{{"text": String}}] (2-3 actionable suggestions for reducing environmental impact),
  "suggestedQuestions": [String] (3-4 related follow-up questions users might want to ask)

IMPORTANT::
Tips for each field:
- rating: Consider data quality, source reliability, and how complete the information is
- text: Structure the answer logically, use specific numbers/metrics when available (DO NOT answer in more than 4-5 points for this part cover everything important such as:
   1.The way the user could use it in a better way and how to use it mindfully.
   2.What are the ways it affects the environment.
   3.How can it be harmful for different people and how it affects the health.
   4.try to make them a bit aware of the long term damage the product causes.
   5.How can they try their best to use the harmful wastes produced from the product into something good or how can they minimise it if not make it useful.
   )
- citations: Always link to authoritative sources like environmental databases or research papers, use links instead of texts
- recommendations: Focus on practical, achievable actions for consumers
- suggestedQuestions: Questions should explore related environmental aspects not covered in main answer

-------------------------------------------------------------------------------------

For type == 2: Give all the answers in MARKDOWN Format, everything must be in markdown the sources links example: [Source name](url)
 and also give images in the answer such as graphs of the anlysis like this IF AVAILABLE dont give example in your own response:
(
 The result is shown below:
![Result Chart](https://www.shutterstock.com/image-vector/set-business-graph-icon-colors-object-1939043917)
) and give everything in markdown with proper syntax:
(
Example:
Reducing Energy Consumption and Carbon Footprint in Daily Life
===========================================================

As an individual, making conscious choices in your daily life can significantly reduce your energy consumption and carbon footprint...

### Strategies for Reducing Energy Consumption and Carbon Footprint

1. **Switch to Energy-Efficient Appliances**: Replace traditional incandescent bulbs...
2. **Use Public Transport, Walk, or Bike**: Using public transport, walking, or biking...
3. **Turn Off Lights, Electronics, and Taps**: Simple actions like turning off lights...

### Notable Controversies and Trade-Offs

* The production of renewable energy technologies...
* The adoption of plant-based diets...

### Conclusion

Reducing energy consumption and carbon footprint in daily life requires a multifaceted approach...

### References

* IPCC (2022). Chapter 6: Energy Systems...
* UNEP (n.d.). 10 Ways to Help Fight Climate Crisis...
), and follow the below prompt:
Provide a detailed, text-only analysis on the subject of climate change or environmental impact. The topic can focus either on a specific product (such as its carbon footprint,
sustainability, or environmental trade-offs) or cover a broader issue (such as rising global temperatures, ocean acidification, deforestation, or the effectiveness of renewable energy).
Your analysis should include:

A clear explanation of the key scientific or environmental principles involved.
Discussion of current challenges and risks.
The role of human activities or industries in shaping the issue.
Possible solutions or innovations addressing the problem.
Any notable controversies, trade-offs, or debates surrounding it.

--------------------------------------------------------------------------------------
IMPORTANT ::: CONSIDER THE USER'S LOCATION, GIVEN BY LATITUDE AND LONGITUDE, WHILE ANSWERING
DO NOT ANSWER EMPTY QUESTIONS OR NOTES.
Context: {documents}
Question: {question}
Latitude: {latitude}
Longitude: {longitude}

<|eot_id|><|start_header_id|>assistant<|end_header_id|>
""",
    input_variables=["question", "documents", "type", "latitude", "longitude"],
)


rag_chain = prompt | llm | StrOutputParser()

final_rag_chain = final_prompt | llm 

retrieval_prompt = PromptTemplate(
    template="""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
    You are a grader assessing relevance of a retrieved document to a user question. \n
    Here is the retrieved document: \n\n {document} \n\n

    <|eot_id|><|start_header_id|>user<|end_header_id|>
    Here is the user question: {question} \n

    Give a binary score 'yes' or 'no' to indicate whether the answer is useful to resolve a question. \n
    Provide the binary score as a JSON with a single key 'score' and no preamble or explanation. <|eot_id|><|start_header_id|>assistant<|end_header_id|>""",
    input_variables=["question", "document"],
)

retrieval_grader = retrieval_prompt | llm | JsonOutputParser()

decomposer_prompt = PromptTemplate(
    template="""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
    type : {type}
    when type == 1 then you will not decompose the question just return the same as one element in the list nothing else.
---------------------------------------------------------------------------------------------------------------------------
    when type == 2 follow the steps:
You are a helpful assistant that breaks down user queries about environmental impacts of consumer products into clear sub-questions. 
Your goal is to help the system understand what specific information (e.g., carbon footprint, water usage, recyclability, ethical sourcing) needs to be retrieved to answer the user’s question.

- Focus on aspects such as life cycle assessment (LCA), sustainability, recyclability, emissions, and sourcing practices.
- Always use full product names or descriptions — never use vague pronouns like "it", "they", "these", etc.
- If the question includes a comparison, generate sub-questions for each product.
- YOU WILL NEVER GIVE EMPTY STRINGS IN THE LIST AND NO NOTES ONLY THE QUESTIONS MUST BE THERE IN THE LIST.

Examples:

Example 1:
Question: What's the carbon footprint of a Nestle chocolate bar compared to an oat-based snack bar?
Decompositions:
What is the carbon footprint of a Nestle chocolate bar?
What is the carbon footprint of an oat-based snack bar?

Example 2:
Question: Is Dove soap recyclable and ethically sourced?
Decompositions:
Is Dove soap recyclable?
Is Dove soap ethically sourced?

Example 3:
Question: Show me the water usage of a T-shirt from H&M.
Decompositions:
What is the water usage of a T-shirt from H&M?

Example 4:
Question: What is the capital of Japan?
Decompositions:
What is the capital of Japan?

Your list should not contain empty strings or any notes.
<|eot_id|><|start_header_id|>user<|end_header_id|>
Question: {user_query} <|eot_id|><|start_header_id|>assistant<|end_header_id|>
Decompositions:""",
    input_variables=["user_query", "type"]
)

query_decompose = decomposer_prompt | llm | StrOutputParser()

from typing_extensions import TypedDict, List
from IPython.display import Image, display
from langgraph.graph import START, END, StateGraph

class GraphState(TypedDict):
    """
    Represents the state of our graph.
    Attributes:
        question: question to be used as input in LLM chain
        generation: LLM generation response
        search: "yes" or "no" string acting as boolean for whether to invoke web search
        documents: list of documents for in-context learning
        steps: List of steps taken in agent flow
        user_query: original user query, stored here for persistence during consolidation stage
        sub_answers: list of answers to decomposed questions
    """
    question: str
    generation: str
    search: str
    documents: List[str]
    steps: List[str]
    user_query: str
    sub_answers: List[str]
    sub_questions: List[str]
    final_response: str
    structured_output: dict
    type: int
    latitude: float
    longitude: float

def retrieve(state):
    """
    Retrieve documents
    This is the first Node invoked in the CRAG_graph

    # CRAG_graph is invoked in the CRAG_loop node:
    #response = CRAG_graph.invoke({"question": q, "steps": steps})["generation"]
    #we initialize the state with a sub-question and list of steps

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): New key added to state, documents, that contains retrieved documents
    """
    print("---Retrieving Documents---", flush= True)
    question = state["question"]
    steps = state["steps"]
    steps.append("retrieve_documents")
    documents = retriever.invoke(question)
    return {"documents": documents, "question": question, "steps": steps}

def grade_documents(state):
    """
    Determines whether the retrieved documents are relevant to the question. Store all relevant documents to the documents dictionary.
    However, if there is even one irrelevant document, then websearch will be invoked.

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): Updates documents key with only filtered relevant documents
    """
    print("---Grading Retrieved Documents---", flush= True)
    documents = state["documents"]
    question = state["question"]
    steps = state["steps"]
    steps.append("grade_document_retrieval")
    relevant_docs = []
    search = "No"
    for d in documents:
        score = retrieval_grader.invoke({"question": question, "document": d.page_content})
        if score["score"] == "yes":
            relevant_docs.append(d)
        else:
            search = "Yes"
    return {"documents": relevant_docs, "question": question, "search": search, "steps": steps}

def decide_to_generate(state):
    """
    Determines whether to generate an answer, or re-generate a question.

    Args:
        state (dict): The current graph state

    Returns:
        str: Binary decision for next node to call
    """
    # print("---At decision Edge---")
    """-----------inputs-----------"""
    search = state["search"]

    """-----------actions & outputs-----------"""
    if search == "Yes":
        return "search"
    else:
        return "generate"

def web_search(state):
    print("---Searching the Web---", flush= True)
    documents = state.get("documents", [])
    question = state["question"]
    steps = state["steps"]
    steps.append("web_search")

    trusted_sites = ["ecoinvent.org", "openlca.org", "unep.org", "sciencebasedtargets.org", "climate-data.org", "ipcc.ch", "world.openfoodfacts.org"]
    constrained_query = question + " " + " OR ".join([f"site:{site}" for site in trusted_sites])

    web_results = web_search_tool.invoke({"query": constrained_query})

    documents.extend(
        [
            Document(page_content=d["content"], metadata={"url": d["url"]})
            for d in web_results
        ]
    )
    return {
        "documents": documents,
        "question": question,
        "steps": steps
    }


def generate(state):
    """
    Generate answer with location context

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): New key added to state, generation, that contains LLM generation
    """
    print("---Generating Response---", flush = True)
    documents = state["documents"]
    question = state["question"]
    steps = state["steps"]
    latitude = state.get("latitude", None)
    longitude = state.get("longitude", None)
    steps.append("generating sub-answer")
    query_type = state.get("type", 2)
    
    generation = rag_chain.invoke({
        "documents": documents, 
        "question": question,
        "latitude": latitude,
        "longitude": longitude
    })
    
    return {
        "documents": documents, 
        "question": question, 
        "generation": generation, 
        "steps": steps
    }

CRAG = StateGraph(GraphState)

CRAG = StateGraph(GraphState)
CRAG.add_node("retrieve", retrieve)
CRAG.add_node("grade_documents", grade_documents)
CRAG.add_node("generate", generate)
CRAG.add_node("web_search", web_search)
CRAG.set_entry_point("retrieve")
CRAG.add_edge("retrieve", "grade_documents")
CRAG.add_conditional_edges("grade_documents", decide_to_generate, {"search": "web_search", "generate": "generate"})
CRAG.add_edge("web_search", "generate")
CRAG.add_edge("generate", END)
CRAG_graph = CRAG.compile()

json_structure_prompt = PromptTemplate(
    template="""
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an assistant formatting environmental impact assessments.
Given the following unstructured answer, return a JSON object with the following fields:

{{
  "rating": Number (0-100, representing your rating as an environmental expert, of the impacts of using that product based on the unstructured answer),
  "text": String (comprehensive answer addressing environmental impacts including carbon footprint, water usage, waste generation, etc.),
  "citations": [ {{"label": String, "url": String}} ] (list of source objects with label and URL that support your answer, minimum 1 source),
  "recommendations": [ {{"text": String}} ] (2-3 actionable suggestions for reducing environmental impact),
  "suggestedQuestions": [ String ] (3-4 related follow-up questions users might want to ask)
}}

Include all the information provided in the unstructured answer.

Tips for each field:
- rating: Consider data quality, source reliability, and how complete the information is
- text: Structure the answer logically, use specific numbers/metrics when available
- citations: Always link to authoritative sources like environmental databases or research papers, use normal text where URLs/links are not available
- recommendations: Focus on practical, achievable actions for consumers
- suggestedQuestions: Questions should explore related environmental aspects not covered in main answer

Unstructured Answer:
{text}
IMPORTANT :: DO NOT GIVE ANY OUTPUT OTHER THAN JSON OBJECT. NOT EVEN A NOTE NO-THING. 
<|eot_id|><|start_header_id|>assistant<|end_header_id|>
""",
    input_variables=["text"],
)

json_consolidator = json_structure_prompt | llm | StrOutputParser()

def transform_query(state: dict) -> dict:
    user_query = state["user_query"]
    steps = state["steps"]
    query_type = state.get("type", 2)
    print("---Decomposing the QUERY---", flush=True)
    steps.append("transform_query")
    type = state["type"]
    sub_questions = query_decompose.invoke({"user_query": user_query, "type" : type})
    list_of_questions = [q.strip() for q in sub_questions.strip().split('\n')]

    if list_of_questions[0] == 'The question needs no decomposition':
        return {
            **state,
            "sub_questions": [user_query],
            "steps": steps,
        }
    else:
        return {
            **state,
            "sub_questions": list_of_questions,
            "steps": steps,
        }


def CRAG_loop(state: dict) -> dict:
    questions = state["sub_questions"]
    steps = state["steps"]
    user_query = state["user_query"]
    query_type = state.get("type", 2)
    sub_answers = []

    steps.append("entering iterative CRAG for sub questions")

    for q in questions:
        response = CRAG_graph.invoke({"question": q, "steps": steps, "type": query_type})["generation"]
        sub_answers.append(response)

    return {
        **state,
        "sub_answers": sub_answers,
        "steps": steps,
    }


def consolidate(state: dict) -> dict:
    print("---Consolidating Response---", flush= True)
    answers = state['sub_answers']
    questions = state['sub_questions']
    user_query = state['user_query']
    steps = state["steps"]
    query_type = state.get("type", 2)
    latitude = state["latitude"]
    longitude = state["longitude"]

    steps.append("generating final answer")
    if query_type == 1:
        qa_pairs = [{questions[i]: answers[i].strip()} for i in range(min(len(questions), len(answers)))]
        raw_response = final_rag_chain.invoke({"documents": qa_pairs, "question": user_query, "type" : 1, "latitude": latitude, "longitude": longitude})
        structured_response = json_consolidator.invoke({"text": raw_response})
        return {
            **state,
            "final_response": structured_response,
            "steps": steps,
            "intermediate_qa": qa_pairs,
        }
    else:
        qa_pairs = [{questions[i]: answers[i].strip()} for i in range(min(len(questions), len(answers)))]
        raw_response = final_rag_chain.invoke({"documents": qa_pairs, "question": user_query, "type" : 2, "latitude": latitude, "longitude": longitude})
        return {
            **state,
            "final_response": raw_response,
            "steps": steps,
            "intermediate_qa": qa_pairs,
        }


nested_CRAG = StateGraph(GraphState)
nested_CRAG.add_node("transform_query", transform_query)
nested_CRAG.add_node("CRAG_loop", CRAG_loop)
nested_CRAG.add_node("consolidate", consolidate)
nested_CRAG.set_entry_point("transform_query")
nested_CRAG.add_edge("transform_query", "CRAG_loop")
nested_CRAG.add_edge("CRAG_loop", "consolidate")
nested_CRAG.add_edge("consolidate", END)

agentic_rag = nested_CRAG.compile()

if len(sys.argv) >= 5:
    user_query = sys.argv[1]
    try:
        type = int(sys.argv[2])
    except (ValueError, IndexError):
        type = 2
    try:
        latitude = float(sys.argv[3])
    except (ValueError, IndexError):
        latitude = None
    try:
        longitude = float(sys.argv[4])
    except (ValueError, IndexError):
        longitude = None
    response = agentic_rag.invoke({"user_query": user_query, "steps": [], "type" : type, "latitude": latitude, "longitude": longitude})
    print("===RESULT===")
    print(json.dumps({"result": response}), flush=True)
else:
    print("Not enough arguments received.")