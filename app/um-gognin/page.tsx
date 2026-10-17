export const metadata = { title: "Um gögnin og aðferðafræði" };
export default function About() {
  return (
    <main id="main" className="reading-page">
      <span className="eyebrow">OPIN GÖGN · SKÝRAR FORSENDUR</span>
      <h1>
        Raunveruleg viðskipti.
        <br />
        Með fyrirvara um raunveruleikann.
      </h1>
      <p>
        Fasteign hjálpar þér að skoða þinglýst kaupverð íbúða á
        höfuðborgarsvæðinu. Allar verðtölur byggja á Kaupskrá HMS. Vefurinn er
        sjálfstætt verkefni og er ekki á vegum HMS eða Reykjavíkurborgar.
      </p>
      <h2>Hvaðan koma gögnin?</h2>
      <p>
        Byggir á upplýsingum frá{" "}
        <a href="https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/kaupskra-fasteigna">
          HMS — Kaupskrá fasteigna
        </a>
        . Skráin er uppfærð daglega og getur breyst aftur í tímann. Þinglýsing
        getur komið nokkru eftir undirritun; nýjustu mánuðirnir eru því
        ófullkomnir.
      </p>
      <p>
        Staðsetningar eru tengdar með heitinúmeri úr{" "}
        <a href="https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra">
          Staðfangaskrá HMS
        </a>
        . Kort og borgarhlutamörk:{" "}
        <a href="https://reykjavik.is/landupplysingar">
          Reykjavíkurborg / LUKR
        </a>
        . Bakgrunnskort:{" "}
        <a href="https://www.openstreetmap.org/copyright">
          OpenStreetMap contributors
        </a>
        .
      </p>
      <h2>Hvaða sölur teljast með?</h2>
      <ul>
        <li>
          Íbúðir í fjölbýli og sérbýli í Reykjavík, Kópavogi, Hafnarfirði,
          Garðabæ, Mosfellsbæ, Seltjarnarnesi og Kjósarhreppi.
        </li>
        <li>
          Samningar sem HMS merkir ekki ónothæfa og eignir sem eru skráðar
          fullbúnar. Óþekkt gildi eru ekki talin staðfest.
        </li>
        <li>
          Jákvætt kaupverð og flatarmál og gild dagsetning. Viðskipti með fleiri
          færslur á sama skjali eru undanskilin til að forðast tvítalningu og
          óljóst verð á eign.
        </li>
        <li>
          Sé sama sala (sama eign, dagsetning og verð) skráð tvisvar undir
          ólíkum skjalanúmerum er aðeins fyrsta skráningin talin.
        </li>
        <li>
          Öfgagildi fermetraverðs eru greind innan sveitarfélags, árs og
          tegundar með ytri fjórðungamörkum á log-kvarða. Úrtök undir 30 sölum
          eru ekki skorin með þeirri reglu.
        </li>
      </ul>
      <p>
        Ónothæfir samningar geta meðal annars verið milli skyldra, hlutakaup eða
        sala margra eigna. Þeir eru varðveittir í frumgögnum og úttektarskrá en
        hafa ekki áhrif á venjulegar verðtölur.
      </p>
      <h2>Hvernig reiknum við?</h2>
      <p>
        Fermetraverð er kaupverð deilt með skráðu einingarflatarmáli. Miðgildi
        er miðjan í röðuðum gildum; við reiknum ekki meðaltal miðgilda svæða.
        Kaupverð er í krónum, án verðbólguleiðréttingar. Fjárhæðir frumskrár eru
        túlkaðar í þúsundum króna og margfaldaðar með 1.000; eigindalýsing HMS
        tilgreinir ekki eininguna sérstaklega og staðfesting hennar er á lista
        fyrir opinbera útgáfu.
      </p>
      <p>
        Færri en fimm sölur: verðtölur eru faldar. Fimm til níu: viðvörun um
        fáar sölur. Verðbreyting er aðeins sýnd þegar bæði valið tímabil og
        jafnlangt fyrra tímabil hafa að minnsta kosti tíu sölur. Breytingar á
        tegundum og stærðum seldra eigna geta skýrt breytingu miðgildis; þetta
        er ekki gæðaleiðrétt vísitala.
      </p>
      <p>
        Verðgröf sýna þriggja mánaða hlaupandi miðgildi. Í hverjum mánuði eru
        teknar sölur þess mánaðar og tveggja fyrri mánaða. Glugginn getur náð
        aftur fyrir upphaf valins tímabils. Mánaðarlegur sölufjöldi er hins
        vegar eingöngu fjöldi þess mánaðar. Úrtaksstærðir eru aðgengilegar með
        gögnunum á Markaðurinn.
      </p>
      <h2>Hvað sýnir kortið?</h2>
      <p>
        Lituðu flákarnir sýna opinber póstsvæði höfuðborgarsvæðisins. Einnig má
        velja tíu borgarhluta Reykjavíkur. Byggt á gögnum frá Byggðastofnun.
        Póstsvæðamörk eru núgildandi en tölur fylgja póstnúmeri kaupsamnings.
        Póstsvæði geta náð yfir fleiri en eitt sveitarfélag. Litirnir skiptast
        eftir fimmtungum dreifingar gildra svæðistalna. Grátt merkir að gögn
        skorti til birtingar.
      </p>
      <p>
        Aðeins ein ótvíræð staðsetning með samsvarandi heitinúmeri og
        sveitarfélagi er notuð. Hnit sem þarfnast endurskoðunar eru ekki notuð.
        Opinber hnit sem ekki eru merkt yfirfarin eru auðkennd sem slík.
        Núverandi staðföng staðfesta ekki endilega sögulega staðsetningu. Engin
        hnit eru búin til eða áætluð af vefnum.
      </p>
      <p>
        Sölur án staðsetningar teljast með í sveitarfélags- og póstnúmeratölum,
        en ekki borgarhlutatölum. Val um einstakar sölur sýnir allt að 1.500
        nýjustu staðsettu sölurnar með þyrpingum; sú takmörkun hefur ekki áhrif
        á útreikning verðtalna.
      </p>
      <h2>Eignaleit fyrir verðmat</h2>
      <p>
        Leita má eftir heimilisfangi eða fastanúmeri og velja tiltekna íbúð.
        Einingarnúmer (FEPILOG) er birt óbreytt úr Kaupskrá HMS. Upplýsingar
        miðast við nýjasta skráða samning eignarinnar og geta verið úreltar.
        Yfirfarðu stærð, herbergi og byggingarár áður en þú biður um mat. Leit
        nær ekki til allra eigna og segir ekkert um núverandi eigendur. Fyrri
        sölur valinnar eignar eru ekki notaðar sem samanburður við hana sjálfa.
      </p>
      <h2>Hvað segir verðmatið?</h2>
      <p>
        Tilraunalíkanið velur allt að 50 sambærilegar sölur síðustu 24 mánaða
        (sjálfgefið) í sama póstnúmeri og af sömu tegund. Stærð þarf að vera á
        bilinu 65–150% af stærð eignarinnar. Lík stærð, herbergi, byggingarár og
        nýleg sala auka vægi. Aðeins nýjasta gjaldgenga sala hverrar eignar er
        notuð.
      </p>
      <p>
        Miðpunkturinn er vegið miðgildi fermetraverðs margfaldað með stærð.
        Bilið er 10.–90. veginn hundraðshluti sama samanburðar. Það er ekki
        staðfest spábil. Ef færri en fimm eignir eða virk úrtaksstærð undir fimm
        liggja að baki er ekkert mat birt. Gagnastuðningur er aldrei kallaður
        mikill án óháðrar sannprófunar.
      </p>
      <p>
        Líkanið metur ekki ástand, útsýni, hæð, bílskúr eða endurbætur. Það er
        ekki formlegt verðmat eða lánshæfismat.
      </p>
      <p>
        Við matið sést hvaða sölur réðu niðurstöðunni og hvers vegna: vægi
        hverrar sölu er margfeldi fjögurra þátta (stærð, herbergi, byggingarár,
        tími frá sölu). Sýnt er hve stór hluti vægis kemur frá sölum eldri en 12
        mánaða og frá ólíkari eignum, og hvernig miðpunktur breytist ef einni af
        tíu vægismestu sölunum er sleppt. Sviðsmyndir endurreikna sömu aðferð
        með breyttri stærð, herbergjafjölda, byggingarári eða 12, 24 eða 36
        mánaða tímabili. Þær sýna hve mikið niðurstaðan veltur á forsendum, ekki
        aukna nákvæmni, og ef of fáar sölur finnast er ekkert mat birt.
      </p>
      <p>
        Aðferðin hefur verið prófuð afturvirkt á átta ársfjórðungum: fyrir
        hverja sölu var aðeins notast við samninga sem þá höfðu verið
        þinglýstir. Niðurstöður prófunarinnar eru sýndar með matinu. Þær eru
        meðaltal yfir margar eignir og gera bilið ekki að kvörðuðu öryggisbili
        fyrir einstaka eign.
      </p>
      <h2>Dreifing verðs og hundraðshlutar</h2>
      <p>
        Á Markaðnum má sjá hvernig kaupverð eða fermetraverð dreifist innan
        valinna sía og hvar tiltekið verð lendir. Hundraðshlutar eru reiknaðir
        með línulegri brúun milli raðaðra gilda (sama aðferð og sjálfgefin er í
        R og NumPy). Staða verðs er hlutfall sala á lægra verði að viðbættum
        helmingi sala á sama verði. Miðgildi birtist frá fimm sölum, en
        hundraðshlutar, súlurit og staða verðs aðeins frá 20 sölum. Súlur eru
        jafnbreiðar með opnum endum og engin súla sýnir færri en fimm sölur.
        Viðvörun birtist þegar hópurinn blandar saman fjölbýli og sérbýli,
        stærðir eru mjög ólíkar, tímabilið er lengra en þrjú ár eða hópurinn nær
        yfir mörg hverfi. Ásett verð er aldrei notað.
      </p>
      <h2>Sölusaga eignar</h2>
      <p>
        Sölusaga sýnir alla skráða kaupsamninga íbúðar á höfuðborgarsvæðinu frá
        2006, tengda saman með fastanúmeri. Fastanúmer getur haldist þótt eign
        sé stækkuð, sameinuð eða endurskráð, svo einnig er borið saman
        einingarnúmer, skráð stærð og tegund. Sagan er merkt samfelld þegar
        þetta helst óbreytt, annars óviss. Verðbreyting er aðeins reiknuð milli
        samninga um eina eign sem HMS telur nothæfa; samningar um fleiri eignir
        eða óvenjuleg kjör eru sýndir en ekki bornir saman. Sami samningur
        skráður tvisvar er talinn einu sinni og er undanskilinn verðtölum.
      </p>
      <p>
        Fyrra söluverð er ekki fyrra verðmæti sömu eignar: endurbætur, ástand og
        kjör geta skýrt muninn. Breytingar eru í nafnverði og eru hvorki ávöxtun
        né verðvísitala.
      </p>
      <h2>Nýskráðar sölur og þinglýsingartími</h2>
      <p>
        Fasteign ber kaupskrána saman við fyrri niðurhöl á hverjum degi og
        skráir hvenær hver færsla sást fyrst. Sá dagur segir ekki hvenær eign
        seldist: salan miðast við undirritun kaupsamnings og þinglýsing kemur
        síðar. Færslur sem voru til þegar eftirlit hófst teljast aldrei nýjar,
        og leiðréttingar HMS á eldri færslum eru taldar sér.
      </p>
      <p>
        Biðtími frá undirritun til þinglýsingar er reiknaður eftir
        þinglýsingarmánuði. Út frá samningum sem eru eins til tveggja ára er
        metið hve stór hluti samninga er venjulega þinglýstur eftir tiltekinn
        tíma, og nýjustu mánuðir eru merktir líklega ófullgerðir. Við áætlum
        ekki hversu margar óskráðar sölur eru til. Biðtími er ekki sölutími á
        markaði.
      </p>
      <h2>Persónuvernd og endurnotkun</h2>
      <p>
        Vefurinn birtir upplýsingar um eignir og opinbera kaupsamninga. Við
        reynum ekki að bera kennsl á kaupendur, seljendur eða íbúa. Engin
        innskráning er nauðsynleg. Útlitsval vistast í vafranum. Kortaflísar eru
        sóttar til kortaþjónustu.
      </p>
      <p>
        Endurnotkun HMS-gagna er háð{" "}
        <a href="https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/kaupskra-fasteigna">
          upprunatilvísun og birtum notkunarleiðbeiningum
        </a>
        . Gögnin fela ekki í sér ábyrgð eða opinbera staðfestingu á niðurstöðum
        þessa vefs.
      </p>
    </main>
  );
}
