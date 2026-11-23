export interface NcmEntry {
  code: string;
  digits: string;
  description: string;
  keywords?: string;
}

export const INITIAL_OFFICIAL_NCM_SEED: NcmEntry[] = [
  // Bebidas (Capítulo 22)
  { code: '2201.10.00', digits: '22011000', description: 'Águas minerais e águas gaseificadas, não adicionadas de açúcar ou de outros edulcorantes nem aromatizadas', keywords: 'agua mineral sem gas com gas garrafa copo' },
  { code: '2201.90.00', digits: '22019000', description: 'Outras águas, gelo e neve', keywords: 'gelo cubo agua filtrada' },
  { code: '2202.10.00', digits: '22021000', description: 'Águas, incluindo as águas minerais e as águas gaseificadas, adicionadas de açúcar ou de outros edulcorantes ou aromatizadas (refrigerantes)', keywords: 'refrigerante coca cola guarana fanta sprite pepsi soda lata pet 350ml 2l' },
  { code: '2202.91.00', digits: '22029100', description: 'Cerveja sem álcool', keywords: 'cerveja sem alcool zero' },
  { code: '2202.99.00', digits: '22029900', description: 'Outras bebidas não alcoólicas (energéticos, chás prontos, néctares e bebidas lácteas)', keywords: 'energetico red bull monster cha gelado mate isotonico gatorade toddynho achocolatado pronto' },
  { code: '2203.00.00', digits: '22030000', description: 'Cervejas de malte', keywords: 'cerveja chopp chope pilsen ipa heineken brahma skol budweiser long neck garrafa 600ml' },
  { code: '2204.10.10', digits: '22041010', description: 'Vinhos espumantes e espumosos tipo champanhe', keywords: 'espumante champanhe champagne prosecco' },
  { code: '2204.21.00', digits: '22042100', description: 'Outros vinhos de uvas frescas em recipientes de capacidade não superior a 2 litros', keywords: 'vinho tinto branco rose garrafa taca' },
  { code: '2206.00.10', digits: '22060010', description: 'Sidra e outras bebidas fermentadas de frutas', keywords: 'sidra cerveja de fruta fermentado' },
  { code: '2208.30.20', digits: '22083020', description: 'Uísque (whisky) em recipientes de capacidade inferior ou igual a 2 litros', keywords: 'whisky uisque dose garrafa jack daniels johnnie walker' },
  { code: '2208.40.00', digits: '22084000', description: 'Rum e outras aguardentes provenientes da destilação de produtos da cana-de-açúcar (cachaça)', keywords: 'cachaca pinga aguardente rum caipirinha' },
  { code: '2208.50.00', digits: '22085000', description: 'Gim e genebra', keywords: 'gin gim tonica tanqueray' },
  { code: '2208.60.00', digits: '22086000', description: 'Vodca', keywords: 'vodka vodca absolut smirnoff' },
  { code: '2208.90.00', digits: '22089000', description: 'Outras bebidas destiladas, licores e bebidas espirituosas', keywords: 'licor tequila aperitivo campari aperol drink coquetel' },

  // Laticínios, Ovos e Mel (Capítulo 04)
  { code: '0401.10.10', digits: '04011010', description: 'Leite UHT (Ultra High Temperature) com teor de matérias gordas não superior a 1% (desnatado)', keywords: 'leite desnatado uht caixinha' },
  { code: '0401.20.10', digits: '04012010', description: 'Leite UHT integral ou semidesnatado com teor de gorduras superior a 1% e não superior a 6%', keywords: 'leite integral semidesnatado uht caixa litro' },
  { code: '0402.10.10', digits: '04021010', description: 'Leite em pó desnatado com teor de arsênio, chumbo ou cobre dentro dos limites', keywords: 'leite em po' },
  { code: '0402.21.10', digits: '04022110', description: 'Leite em pó integral sem adição de açúcar', keywords: 'leite em po integral ninho' },
  { code: '0402.99.00', digits: '04029900', description: 'Leite condensado e outros leites concentrados adicionados de açúcar', keywords: 'leite condensado moca' },
  { code: '0403.10.00', digits: '04031000', description: 'Iogurte', keywords: 'iogurte natural grego morango bebida lactea' },
  { code: '0403.90.00', digits: '04039000', description: 'Leitelho, leite e creme de leite coalhados, quefir e outros leites fermentados', keywords: 'coalhada leite fermentado yakult' },
  { code: '0405.10.00', digits: '04051000', description: 'Manteiga', keywords: 'manteiga com sal sem sal' },
  { code: '0406.10.10', digits: '04061010', description: 'Queijo mussarela (mozarela)', keywords: 'queijo mussarela mozarela fatiado' },
  { code: '0406.10.90', digits: '04061090', description: 'Outros queijos frescos, incluindo queijo de soro de leite e requeijão', keywords: 'requeijao cremoso queijo minas frescal ricota cream cheese' },
  { code: '0406.90.20', digits: '04069020', description: 'Queijos com teor de umidade superior ou igual a 36% e inferior a 46% (prato, cheddar)', keywords: 'queijo prato cheddar gouda' },
  { code: '0406.90.30', digits: '04069030', description: 'Queijos com teor de umidade inferior a 36% (parmesão, provolone)', keywords: 'queijo parmesao ralado provolone' },
  { code: '0407.21.00', digits: '04072100', description: 'Ovos frescos de galinha da espécie Gallus domesticus', keywords: 'ovo ovos duzia bandeja' },
  { code: '0409.00.00', digits: '04090000', description: 'Mel natural', keywords: 'mel abelha pote' },

  // Carnes, Frios e Peixes (Capítulos 02, 03, 16)
  { code: '0201.30.00', digits: '02013000', description: 'Carnes de animais da espécie bovina, desossadas, frescas ou refrigeradas', keywords: 'carne bovina picanha alcatra contra file mignon patinho acem bife' },
  { code: '0202.30.00', digits: '02023000', description: 'Carnes de animais da espécie bovina, desossadas, congeladas', keywords: 'carne bovina congelada hamburguer' },
  { code: '0203.29.00', digits: '02032900', description: 'Outras carnes de animais da espécie suína, congeladas', keywords: 'carne suina porco costela lombo bisteca' },
  { code: '0207.12.00', digits: '02071200', description: 'Carnes de galos e galinhas, não cortadas em pedaços, congeladas', keywords: 'frango inteiro congelado' },
  { code: '0207.14.00', digits: '02071400', description: 'Pedaços e miudezas comestíveis de galos e galinhas, congelados (peito, coxa, filé)', keywords: 'peito de frango file de frango coxa sobrecoxa asa tulipa' },
  { code: '0210.12.00', digits: '02101200', description: 'Barrigas (entremeadas) e seus pedaços, de suínos, salgados ou defumados (bacon)', keywords: 'bacon defumado fatiado' },
  { code: '0302.14.00', digits: '03021400', description: 'Salmões-do-atlântico e salmões-do-danúbio, frescos ou refrigerados', keywords: 'salmao peixe sashimi sushi' },
  { code: '0304.61.00', digits: '03046100', description: 'Filés de tilápias, congelados', keywords: 'tilapia file de peixe' },
  { code: '1601.00.00', digits: '16010000', description: 'Enchidos e produtos semelhantes, de carne, miudezas ou sangue (linguiça, salsicha, salame)', keywords: 'linguica calabresa toscana salsicha hot dog salame mortadela' },
  { code: '1602.32.20', digits: '16023220', description: 'Outras preparações e conservas de carne de galos ou galinhas (nuggets, empanados)', keywords: 'nuggets empanado de frango' },
  { code: '1602.41.00', digits: '16024100', description: 'Pernis e seus pedaços, de suínos, preparados ou em conserva (presunto)', keywords: 'presunto cozido parma fatiado' },
  { code: '1602.50.00', digits: '16025000', description: 'Preparações e conservas de carne ou de miudezas da espécie bovina (hambúrguer preparado)', keywords: 'hamburguer artesanal carne moida temperada kibe' },
  { code: '1604.14.10', digits: '16041410', description: 'Atum em conserva', keywords: 'atum lata solido ralado' },

  // Hortifrúti, Café, Cereais, Farinhas e Óleos (Capítulos 07, 08, 09, 10, 11, 15)
  { code: '0701.90.00', digits: '07019000', description: 'Outras batatas, frescas ou refrigeradas', keywords: 'batata inglesa asterix' },
  { code: '0702.00.00', digits: '07020000', description: 'Tomates frescos ou refrigerados', keywords: 'tomate italiano cereja' },
  { code: '0703.10.19', digits: '07031019', description: 'Outras cebolas frescas ou refrigeradas', keywords: 'cebola roxa branca' },
  { code: '0713.33.19', digits: '07133319', description: 'Feijão comum (Phaseolus vulgaris) preto ou carioca', keywords: 'feijao carioca preto pacote 1kg' },
  { code: '0803.90.00', digits: '08039000', description: 'Bananas, incluindo os plátanos, frescas ou secas', keywords: 'banana prata nanica' },
  { code: '0805.10.00', digits: '08051000', description: 'Laranjas, frescas ou secas', keywords: 'laranja pera lima' },
  { code: '0808.10.00', digits: '08081000', description: 'Maçãs frescas', keywords: 'maca fuji gala' },
  { code: '0811.10.00', digits: '08111000', description: 'Morangos congelados (polpa de morango)', keywords: 'morango polpa fruta congelada' },
  { code: '0901.21.00', digits: '09012100', description: 'Café torrado, não descafeinado (em grão ou moído)', keywords: 'cafe torrado moido expresso espresso coado capsula' },
  { code: '0902.30.00', digits: '09023000', description: 'Chá preto fermentado em embalagens imediatas de conteúdo não superior a 3 kg', keywords: 'cha preto mate sache' },
  { code: '1006.30.21', digits: '10063021', description: 'Arroz semibranqueado ou branqueado, polido ou brunido', keywords: 'arroz branco tipo 1 5kg parboilizado' },
  { code: '1101.00.10', digits: '11010010', description: 'Farinha de trigo', keywords: 'farinha de trigo 1kg' },
  { code: '1507.90.11', digits: '15079011', description: 'Óleo de soja refinado em recipientes com capacidade inferior ou igual a 5 litros', keywords: 'oleo de soja 900ml' },
  { code: '1509.20.00', digits: '15092000', description: 'Azeite de oliva virgem extra', keywords: 'azeite de oliva extra virgem' },
  { code: '1517.10.00', digits: '15171000', description: 'Margarina, exceto a margarina líquida', keywords: 'margarina pote' },

  // Açúcares, Chocolates, Massas, Panificação e Alimentos Preparados (Capítulos 17, 18, 19, 20, 21)
  { code: '1701.99.00', digits: '17019900', description: 'Outros açúcares de cana ou de beterraba refinados ou cristal', keywords: 'acucar cristal refinado demerara' },
  { code: '1704.90.10', digits: '17049010', description: 'Chocolate branco (sem cacau)', keywords: 'chocolate branco barra' },
  { code: '1704.90.20', digits: '17049020', description: 'Balas, caramelos, confeitos e pastilhas sem cacau', keywords: 'bala chiclete pirulito doce' },
  { code: '1806.31.10', digits: '18063110', description: 'Chocolates e outras preparações alimentícias contendo cacau, em tabletes ou barras, recheados', keywords: 'chocolate barra recheado bombom' },
  { code: '1806.32.10', digits: '18063210', description: 'Chocolates em tabletes, barras ou paus, não recheados', keywords: 'chocolate ao leite meio amargo barra' },
  { code: '1806.90.00', digits: '18069000', description: 'Outros chocolates e preparações alimentícias contendo cacau (achocolatado em pó, bombons, brigadeiro)', keywords: 'achocolatado nescau toddy bombom brigadeiro brownie torta de chocolate' },
  { code: '1901.20.00', digits: '19012000', description: 'Misturas e pastas para a preparação de produtos de padaria, pastelaria e da indústria de bolachas', keywords: 'mistura para bolo massa pronta' },
  { code: '1902.19.00', digits: '19021900', description: 'Outras massas alimentícias não cozidas, nem recheadas (macarrão espaguete, parafuso)', keywords: 'macarrao espaguete penne massa seca' },
  { code: '1902.20.00', digits: '19022000', description: 'Massas alimentícias recheadas (mesmo cozidas ou preparadas de outro modo)', keywords: 'lasanha ravioli capeleti nhoque massa recheada' },
  { code: '1902.30.00', digits: '19023000', description: 'Outras massas alimentícias cozidas ou preparadas (macarrão instantâneo, yakisoba)', keywords: 'miojo macarrao instantaneo yakisoba' },
  { code: '1904.10.00', digits: '19041000', description: 'Produtos à base de cereais obtidos por expansão ou torrefação (salgadinhos de milho, cereais matinais)', keywords: 'salgadinho doritos cheetos chips cereal matinal' },
  { code: '1905.31.00', digits: '19053100', description: 'Bolachas e biscoitos adicionados de edulcorantes (doces e recheados)', keywords: 'biscoito recheado bolacha doce cookie wafer' },
  { code: '1905.32.00', digits: '19053200', description: 'Waffles e wafers', keywords: 'waffle wafer' },
  { code: '1905.40.00', digits: '19054000', description: 'Torradas, pão torrado e produtos semelhantes torrados', keywords: 'torrada' },
  { code: '1905.90.10', digits: '19059010', description: 'Pão de forma', keywords: 'pao de forma pao integral brioche pao de hamburguer' },
  { code: '1905.90.20', digits: '19059020', description: 'Bolachas e biscoitos salgados (água e sal, cream cracker)', keywords: 'bolacha agua e sal cream cracker biscoito salgado' },
  { code: '1905.90.90', digits: '19059090', description: 'Outros produtos de padaria, pastelaria ou da indústria de bolachas (pão francês, bolos, salgados assados, pizzas pré-assadas)', keywords: 'pao frances pao de queijo coxinha empada pastel esfiha pizza bolo torta croissant salgado' },
  { code: '2004.10.00', digits: '20041000', description: 'Batatas preparadas ou conservadas (batata frita congelada ou porção)', keywords: 'batata frita porcao de batata palito rustica' },
  { code: '2005.20.00', digits: '20052000', description: 'Batatas preparadas ou conservadas em óleo (batata chips / palha)', keywords: 'batata palha batata chips pringles' },
  { code: '2008.11.00', digits: '20081100', description: 'Amendoins preparados ou conservados (paçoca, pasta de amendoim)', keywords: 'amendoim pacoca pasta de amendoim' },
  { code: '2009.11.00', digits: '20091100', description: 'Suco de laranja congelado, não fermentado', keywords: 'polpa suco de laranja congelado' },
  { code: '2009.12.00', digits: '20091200', description: 'Suco de laranja não congelado, de valor Brix não superior a 20 (suco natural)', keywords: 'suco de laranja natural copo jarra' },
  { code: '2009.89.90', digits: '20098990', description: 'Outros sucos de frutas (abacaxi, maracujá, limão, morango, uva)', keywords: 'suco natural de fruta maracuja abacaxi limao limonada morango polpa' },
  { code: '2101.11.10', digits: '21011110', description: 'Café solúvel, mesmo descafeinado', keywords: 'cafe soluvel nescafe' },
  { code: '2103.20.10', digits: '21032010', description: 'Ketchup e outros molhos de tomate em embalagens imediatas de conteúdo inferior ou igual a 1 kg', keywords: 'ketchup catchup molho de tomate extrato' },
  { code: '2103.90.21', digits: '21039021', description: 'Maionese em embalagens imediatas de conteúdo inferior ou igual a 1 kg', keywords: 'maionese hellmanns' },
  { code: '2103.90.91', digits: '21039091', description: 'Outros molhos e condimentos preparados (mostarda, barbecue, shoyu)', keywords: 'mostarda barbecue shoyu molho' },
  { code: '2105.00.10', digits: '21050010', description: 'Sorvetes, mesmo contendo cacau, em embalagens de conteúdo inferior ou igual a 2 kg', keywords: 'sorvete picole acai na tigela milkshake sundae' },
  { code: '2105.00.90', digits: '21050090', description: 'Outros sorvetes e gelados comestíveis', keywords: 'sorvete massa casquinha gelado' },
  { code: '2106.90.90', digits: '21069090', description: 'Outras preparações alimentícias (lanches prontos, sanduíches, pratos feitos, sobremesas)', keywords: 'x-burguer x-bacon x-salada hamburguer sanduiche hot dog prato feito executivo marmita refeicao pudim mousse sobremesa acai combo' },

  // Ração Animal (Capítulo 23) e Cigarros (Capítulo 24)
  { code: '2309.10.00', digits: '23091000', description: 'Alimentos para cães ou gatos, acondicionados para venda a retalho (ração)', keywords: 'racao cao cachorro gato petisco' },
  { code: '2402.20.00', digits: '24022000', description: 'Cigarros contendo tabaco', keywords: 'cigarro maco tabaco' },

  // Combustíveis & Lubrificantes (Capítulo 27)
  { code: '2710.12.59', digits: '27101259', description: 'Outras gasolinas automotivas', keywords: 'gasolina comum aditivada' },
  { code: '2710.19.21', digits: '27101921', description: 'Óleo diesel', keywords: 'diesel s10 combustivel' },
  { code: '2710.19.32', digits: '27101932', description: 'Óleos lubrificantes com aditivos', keywords: 'oleo lubrificante motor carro moto 5w30 10w40' },
  { code: '2711.19.10', digits: '27111910', description: 'Gás liquefeito de petróleo (GLP)', keywords: 'gas cozinha glp botijao p13' },

  // Medicamentos & Farmácia (Capítulo 30)
  { code: '3004.90.69', digits: '30049069', description: 'Outros medicamentos contendo compostos heterocíclicos (analgésicos, anti-inflamatórios)', keywords: 'dipirona paracetamol ibuprofeno remedio medicamento comprimido' },
  { code: '3004.90.99', digits: '30049099', description: 'Outros medicamentos para medicina humana em doses', keywords: 'medicamento farmacia xarope pomada capsula' },
  { code: '3005.90.90', digits: '30059090', description: 'Pastas (ouates), gazes, ataduras e artigos análogos (curativos)', keywords: 'curativo band-aid gaze atadura esparadrapo' },

  // Perfumaria, Higiene & Cosméticos (Capítulo 33)
  { code: '3303.00.10', digits: '33030010', description: 'Perfumes (extratos)', keywords: 'perfume fragrancia colonia' },
  { code: '3303.00.20', digits: '33030020', description: 'Águas-de-colônia', keywords: 'agua de colonia desodorante colonia' },
  { code: '3304.99.10', digits: '33049910', description: 'Cremes de beleza, cremes nutritivos e loções tônicas', keywords: 'creme hidratante facial protetor solar locao' },
  { code: '3305.10.00', digits: '33051000', description: 'Xampus (shampoos)', keywords: 'shampoo xampu cabelo' },
  { code: '3305.90.00', digits: '33059000', description: 'Outras preparações capilares (condicionadores, máscaras, tinturas)', keywords: 'condicionador creme de pentear mascara capilar tintura' },
  { code: '3306.10.00', digits: '33061000', description: 'Dentifrícios (creme dental)', keywords: 'pasta de dente creme dental colgate oral-b' },
  { code: '3306.90.00', digits: '33069000', description: 'Outras preparações para higiene bucal ou dentária (enxaguante bucal, fio dental)', keywords: 'enxaguante bucal listerine fio dental' },
  { code: '3307.20.10', digits: '33072010', description: 'Desodorantes corporais e antiperspirantes líquidos', keywords: 'desodorante roll-on aerosol antitranspirante rexona dove' },

  // Limpeza & Sabões (Capítulo 34 & 38)
  { code: '3401.11.90', digits: '34011190', description: 'Outros sabões de toucador em barras (sabonetes)', keywords: 'sabonete barra liquido dove lux' },
  { code: '3401.20.90', digits: '34012090', description: 'Sabões sob outras formas (sabão líquido)', keywords: 'sabao liquido roupa' },
  { code: '3402.50.00', digits: '34025000', description: 'Preparações tensoativas e para lavagem acondicionadas para venda a retalho (detergente, sabão em pó)', keywords: 'detergente lava louca sabao em po omo amaciante' },
  { code: '3402.90.39', digits: '34029039', description: 'Outras preparações para lavagem e limpeza (água sanitária, desinfetante, multiuso)', keywords: 'agua sanitaria desinfetante veja multiuso limpador' },
  { code: '3808.91.99', digits: '38089199', description: 'Outros inseticidas', keywords: 'inseticida aerosol repelente' },

  // Plásticos, Embalagens & Papel (Capítulos 39 & 48)
  { code: '3923.21.90', digits: '39232190', description: 'Sacos, bolsas e cartuchos de polímeros de etileno (sacolas plásticas, sacos de lixo)', keywords: 'sacola plastica saco de lixo embalagem' },
  { code: '3924.10.00', digits: '39241000', description: 'Serviços de mesa e outros artigos de cozinha ou de toucador, de plástico (copos, potes, marmitex)', keywords: 'copo descartavel prato plastico pote marmita marmitex' },
  { code: '4818.10.00', digits: '48181000', description: 'Papel higiênico', keywords: 'papel higienico rolo neve' },
  { code: '4818.20.00', digits: '48182000', description: 'Lenços e toalhas de mão, de pasta de papel (papel toalha, guardanapo)', keywords: 'papel toalha guardanapo lenco de papel' },
  { code: '4818.90.90', digits: '48189090', description: 'Outros artigos de uso doméstico de papel (fraldas descartáveis de papel)', keywords: 'absorvente papel descartavel' },
  { code: '9619.00.00', digits: '96190000', description: 'Absorventes e tampões higiênicos, fraldas para bebês e artigos higiênicos semelhantes', keywords: 'fralda descartavel infantil geriatrica absorvente intimo pampers' },

  // Pneus, Materiais de Construção & Ferragens (Capítulos 25, 40, 69, 73)
  { code: '2523.29.10', digits: '25232910', description: 'Cimento Portland comum', keywords: 'cimento saco 50kg obra' },
  { code: '3209.10.10', digits: '32091010', description: 'Tintas à base de polímeros acrílicos dispersos em meio aquoso', keywords: 'tinta acrilica parede lata 18l' },
  { code: '3917.23.00', digits: '39172300', description: 'Tubos rígidos de polímeros de cloreto de vinila (PVC)', keywords: 'tubo pvc cano esgoto agua' },
  { code: '4011.10.00', digits: '40111000', description: 'Pneumáticos novos de borracha dos tipos utilizados em automóveis de passageiros', keywords: 'pneu carro aro 14 15 16 17' },
  { code: '4011.40.00', digits: '40114000', description: 'Pneumáticos novos de borracha dos tipos utilizados em motocicletas', keywords: 'pneu moto motocicleta' },
  { code: '6907.21.00', digits: '69072100', description: 'Ladrilhos e placas de cerâmica com coeficiente de absorção de água inferior ou igual a 0,5% (porcelanato)', keywords: 'porcelanato piso ceramica revestimento' },
  { code: '7318.15.00', digits: '73181500', description: 'Outros parafusos e pernos, mesmo com as porcas e arruelas, de ferro fundido, ferro ou aço', keywords: 'parafuso porca ferragem' },

  // Vestuário & Calçados (Capítulos 61, 62, 64)
  { code: '6109.10.00', digits: '61091000', description: 'T-shirts e camisetas interiores, de malha, de algodão', keywords: 'camiseta camisa algodao malha roupa' },
  { code: '6203.42.00', digits: '62034200', description: 'Calças, jardineiras, bermudas e calções de algodão, de uso masculino', keywords: 'calca jeans bermuda short masculino' },
  { code: '6204.62.00', digits: '62046200', description: 'Calças, jardineiras, bermudas e calções de algodão, de uso feminino', keywords: 'calca feminina saia vestido' },
  { code: '6402.99.90', digits: '64029990', description: 'Outros calçados com sola exterior e parte superior de borracha ou plástico (chinelos, sandálias)', keywords: 'chinelo havaianas sandalia calcado' },
  { code: '6404.11.00', digits: '64041100', description: 'Calçados para esporte e tênis com sola de borracha ou plástico e parte superior têxtil', keywords: 'tenis calcado esportivo' },

  // Eletrônicos, Informática & Autopeças (Capítulos 84, 85, 87)
  { code: '8414.51.10', digits: '84145110', description: 'Ventiladores de mesa, de pé, de parede, de teto ou de janela, com motor elétrico de potência <= 125 W', keywords: 'ventilador mesa coluna' },
  { code: '8415.10.11', digits: '84151011', description: 'Aparelhos de ar condicionado do tipo split-system com capacidade <= 30.000 frigorias/hora', keywords: 'ar condicionado split inverter' },
  { code: '8418.21.00', digits: '84182100', description: 'Refrigeradores de uso doméstico, de compressão (geladeira)', keywords: 'geladeira refrigerador freezer' },
  { code: '8471.30.12', digits: '84713012', description: 'Máquinas automáticas para processamento de dados portáteis (notebook)', keywords: 'notebook laptop computador portatil' },
  { code: '8504.40.10', digits: '85044010', description: 'Carregadores de acumuladores e fontes de alimentação', keywords: 'carregador celular fonte usb' },
  { code: '8506.10.10', digits: '85061010', description: 'Pilhas alcalinas de dióxido de manganês', keywords: 'pilha alcalina aa aaa duracell' },
  { code: '8517.13.00', digits: '85171300', description: 'Telefones inteligentes (smartphones)', keywords: 'smartphone celular iphone samsung xiaomi' },
  { code: '8517.62.41', digits: '85176241', description: 'Roteadores digitais em redes sem fio', keywords: 'roteador wifi modem' },
  { code: '8518.30.00', digits: '85183000', description: 'Fones de ouvido (auscultadores), mesmo combinados com microfone', keywords: 'fone de ouvido headset bluetooth airpods' },
  { code: '8528.72.00', digits: '85287200', description: 'Aparelhos receptores de televisão em cores (Smart TV)', keywords: 'televisao tv smart led oled' },
  { code: '8539.52.00', digits: '85395200', description: 'Lâmpadas e tubos de diodos emissores de luz (LED)', keywords: 'lampada led bulbo' },
  { code: '8544.42.00', digits: '85444200', description: 'Outros condutores elétricos para tensão não superior a 1.000 V, munidos de peças de conexão (cabo USB / HDMI)', keywords: 'cabo usb hdmi extensao eletrica' },
  { code: '8708.30.90', digits: '87083090', description: 'Freios e servo-freios e suas partes, para veículos automóveis (pastilha de freio)', keywords: 'pastilha de freio disco freio autopeca' },
  { code: '8708.99.90', digits: '87089990', description: 'Outras partes e acessórios dos veículos automóveis', keywords: 'autopeca peca automotiva filtro amortecedor' },

  // Livros, Papelaria & Móveis (Capítulos 49, 94, 96)
  { code: '4820.20.00', digits: '48202000', description: 'Cadernos de papel ou cartão', keywords: 'caderno escolar universitario' },
  { code: '4901.99.00', digits: '49019900', description: 'Outros livros, brochuras e impressos semelhantes', keywords: 'livro revista apostila' },
  { code: '9403.60.00', digits: '94036000', description: 'Outros móveis de madeira', keywords: 'mesa cadeira armario estante movel madeira' },
  { code: '9608.10.00', digits: '96081000', description: 'Canetas esferográficas', keywords: 'caneta esferografica bic papelaria' }
];
